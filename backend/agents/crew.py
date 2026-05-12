"""
agents/crew.py — ClynicxMedicalCrew (CrewAI Multi-Agent Orchestrator)

Defines a 4-agent CrewAI Crew with a sequential Process:

  Agent 1 — TriageAgent     (Groq llama-3.3-70b)
    Task : Classify query intent → personal | general | off_topic
           Extract refined RAG search query

  Agent 2 — RAGAgent        (Groq llama-3.3-70b + Mistral tools)
    Task : Embed patient documents (Mistral mistral-embed)
           Retrieve top-K relevant chunks via pgvector cosine search

  Agent 3 — SynthesisAgent  (Groq llama-3.3-70b)
    Task : Generate final medical response grounded in retrieved context

  Agent 4 — SafetyAgent     (Groq llama-3.3-70b + SafetyGuardrailTool)
    Task : Review response for dangerous advice, hallucinations, missing disclaimers

Public interface:
    run_crew(message, user_id, history, data_sharing_consent) → AgentResponse

The crew is executed synchronously inside asyncio.to_thread() so FastAPI's
event loop is never blocked.
"""
import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field

from crewai import Agent, Task, Crew, Process
from agents.tools.mistral_rag_tool import PatientDataEmbedderTool, PatientDataRetrieverTool
from agents.tools.safety_tool import SafetyGuardrailTool

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# LiteLLM model string for CrewAI (works without langchain-groq)
_GROQ_LLM = f"groq/{GROQ_MODEL}"


# ── Response dataclass (mirrors orchestrator.AgentResponse) ───────────────────

@dataclass
class AgentResponse:
    text: str
    agent_used: str
    intent: str
    sources: list = field(default_factory=list)
    consent_needed: bool = False


# ── Synchronous crew execution ────────────────────────────────────────────────

def _run_crew_sync(
    message: str,
    user_id: str,
    history: list,
    data_sharing_consent: bool,
) -> AgentResponse:
    """
    Build and kick off the CrewAI crew synchronously.
    Intended to be called via asyncio.to_thread() from an async context.
    """

    # ── Format history for task context ───────────────────────────────────────
    history_str = "\n".join(
        f"{m['role'].upper()}: {m['content']}"
        for m in (history or [])[-6:]
    ) or "No prior conversation."

    # ── Instantiate tools ──────────────────────────────────────────────────────
    embedder_tool  = PatientDataEmbedderTool()
    retriever_tool = PatientDataRetrieverTool()
    safety_tool    = SafetyGuardrailTool()

    # ── Agent 1: Triage ───────────────────────────────────────────────────────
    triage_agent = Agent(
        role="Medical Query Intent Classifier",
        goal=(
            "Accurately classify the patient's query as 'personal', 'general', or 'off_topic', "
            "and extract a precise semantic search query for the RAG retrieval step."
        ),
        backstory=(
            "You are the intelligent triage system of ClynicxAI, a clinical management platform. "
            "Every patient message passes through you first. You determine whether the patient "
            "is asking about their own health records, general medical knowledge, or something "
            "entirely unrelated to medicine. Your classification directly gates which downstream "
            "agents are activated — an accurate triage is critical for patient safety and relevance."
        ),
        llm=_GROQ_LLM,
        verbose=True,
        allow_delegation=False,
        max_iter=2,
    )

    # ── Agent 2: RAG (Mistral embed + pgvector retrieve) ──────────────────────
    rag_agent = Agent(
        role="Patient Medical Data Retrieval Specialist",
        goal=(
            "Embed patient medical documents using Mistral AI and retrieve the most relevant "
            "chunks via pgvector cosine similarity search to provide grounded context."
        ),
        backstory=(
            "You are the RAG (Retrieval Augmented Generation) specialist of ClynicxAI, powered by "
            "Mistral AI embeddings. You have exclusive access to the patient's medical records "
            "stored in a HIPAA-conscious vector database. When activated, you first embed all "
            "patient reports and prescriptions using Mistral's mistral-embed model, then perform "
            "semantic similarity search to find the most relevant medical data for the patient's query. "
            "You ONLY operate when the query is 'personal' AND the patient has granted data-sharing consent."
        ),
        llm=_GROQ_LLM,
        tools=[retriever_tool],
        verbose=True,
        allow_delegation=False,
        max_iter=3,
    )

    # ── Agent 3: Synthesis ────────────────────────────────────────────────────
    synthesis_agent = Agent(
        role="Senior Medical AI Consultant",
        goal=(
            "Generate accurate, empathetic, and personalized medical responses. "
            "Ground answers in retrieved patient data when available. "
            "Always maintain medical accuracy and recommend professional consultation."
        ),
        backstory=(
            "You are ClynicxAI's senior medical intelligence layer, powered by Groq's "
            "ultra-fast LLM inference. You synthesize answers from patient-specific context "
            "(retrieved by the RAG agent) or from your broad medical knowledge base. "
            "Your responses are clear, well-structured, and evidence-based. "
            "You never make definitive diagnoses — you inform, guide, and recommend. "
            "Patients trust you with sensitive health data; you take that responsibility seriously."
        ),
        llm=_GROQ_LLM,
        verbose=True,
        allow_delegation=False,
        max_iter=2,
    )

    # ── Agent 4: Safety Guardian ──────────────────────────────────────────────
    safety_agent = Agent(
        role="Medical AI Safety & Ethics Guardian",
        goal=(
            "Ensure every medical AI response is safe, clinically responsible, "
            "appropriately disclaimed, and free from dangerous or hallucinated content "
            "before it reaches the patient."
        ),
        backstory=(
            "You are the final safety checkpoint in ClynicxAI's multi-agent pipeline. "
            "No medical response reaches a patient without passing through you. "
            "You systematically check for: dangerous medical instructions, hallucinated lab values, "
            "definitive AI diagnoses, missing disclaimers, and alarming tone. "
            "When you find issues, you correct them precisely — preserving the medical content "
            "while eliminating the risk. Your work protects patients and maintains clinical trust."
        ),
        llm=_GROQ_LLM,
        tools=[safety_tool],
        verbose=True,
        allow_delegation=False,
        max_iter=2,
    )

    # ── Task 1: Intent Classification ─────────────────────────────────────────
    task_classify = Task(
        description=(
            f"Classify the intent of the patient's medical query.\n\n"
            f"CONVERSATION HISTORY:\n{history_str}\n\n"
            f"CURRENT PATIENT QUERY: {message}\n\n"
            f"Classify into EXACTLY ONE of:\n"
            f"  - 'personal'  : Patient asks about THEIR OWN data (my reports, my prescriptions, my results, my medications)\n"
            f"  - 'general'   : General medical question requiring no personal data (symptoms, drug info, disease explanations)\n"
            f"  - 'off_topic' : Not related to health or medicine at all\n\n"
            f"Also extract a refined_rag_query (only if intent is 'personal') — specific search terms "
            f"to find the most relevant chunks from the patient's embedded records.\n\n"
            f"Return ONLY valid JSON, no markdown:\n"
            f'{{"intent": "personal|general|off_topic", "refined_rag_query": "search terms or empty string", "reason": "one-line explanation"}}'
        ),
        expected_output=(
            'Valid JSON with keys: intent (str), refined_rag_query (str), reason (str). '
            'Example: {"intent": "personal", "refined_rag_query": "hemoglobin blood test results", "reason": "patient asking about their lab report"}'
        ),
        agent=triage_agent,
    )

    # ── Task 2: RAG Retrieval ─────────────────────────────────────────────────
    task_retrieve = Task(
        description=(
            f"Based on the triage classification, retrieve relevant patient medical data.\n\n"
            f"PATIENT USER ID  : {user_id}\n"
            f"CONSENT GRANTED  : {data_sharing_consent}\n\n"
            f"DECISION LOGIC:\n"
            f"  • If intent is 'off_topic' or 'general':\n"
            f"    → Return exactly: {{\"context_text\": \"\", \"sources\": [], \"skipped\": true, \"reason\": \"not a personal query\"}}\n"
            f"    → Do NOT call any tools.\n\n"
            f"  • If intent is 'personal' AND consent is False:\n"
            f"    → Return exactly: {{\"context_text\": \"\", \"sources\": [], \"consent_required\": true}}\n"
            f"    → Do NOT call any tools.\n\n"
            f"  • If intent is 'personal' AND consent is True:\n"
            f"    → Use the patient_data_retriever tool to retrieve the patient's medical records.\n"
            f"    → Pass user_id='{user_id}' and the refined_rag_query from Task 1 to the tool.\n"
            f"    → Return the tool's JSON output exactly."
        ),
        expected_output=(
            "JSON with keys: context_text (str), sources (list). "
            "Optionally: skipped (bool) or consent_required (bool). "
            "Example: {\"context_text\": \"Report: Hemoglobin 11.2 g/dL...\", \"sources\": [{\"type\": \"report\", \"id\": \"42\"}]}"
        ),
        agent=rag_agent,
        context=[task_classify],
    )

    # ── Task 3: Response Synthesis ────────────────────────────────────────────
    task_synthesize = Task(
        description=(
            f"Generate the final medical response for the patient.\n\n"
            f"ORIGINAL PATIENT QUERY : {message}\n"
            f"DATA SHARING CONSENT   : {data_sharing_consent}\n\n"
            f"SYNTHESIS RULES (based on Task 1 intent):\n\n"
            f"  • 'off_topic':\n"
            f"    → Politely decline. List what ClynicxAI CAN help with (symptoms, medications, reports, etc.).\n\n"
            f"  • 'general':\n"
            f"    → Answer from your medical knowledge (150-300 words).\n"
            f"    → Add AI disclaimer. Do not use personal data.\n\n"
            f"  • 'personal' + consent=False:\n"
            f"    → Provide a general answer to the question.\n"
            f"    → Append: 'Enable \"Allow AI to access my medical data\" for a personalized answer using your actual records.'\n\n"
            f"  • 'personal' + consent=True:\n"
            f"    → Use Task 2 context to provide a personalized, cited answer.\n"
            f"    → Reference specific report types, dates, lab values from the context.\n"
            f"    → If context is empty, fall back to general knowledge.\n\n"
            f"ALWAYS: Recommend consulting a doctor. NEVER: Make definitive diagnoses. "
            f"NEVER: Invent values not present in the retrieved context."
        ),
        expected_output=(
            "A complete medical response in markdown (150-400 words). "
            "Must include a disclaimer recommending professional medical consultation."
        ),
        agent=synthesis_agent,
        context=[task_classify, task_retrieve],
    )

    # ── Task 4: Safety Review ─────────────────────────────────────────────────
    task_safety = Task(
        description=(
            f"Review the synthesized medical response for patient safety.\n\n"
            f"Use the safety_guardrail tool with the full response from Task 3.\n\n"
            f"The tool will check for:\n"
            f"  1. Dangerous medical instructions (stop medication, dosage changes)\n"
            f"  2. Hallucinated or fabricated medical data\n"
            f"  3. Definitive AI diagnoses\n"
            f"  4. Missing doctor-consultation disclaimer\n"
            f"  5. Unnecessarily alarming tone\n\n"
            f"Return the tool's output as-is — it will be the final patient-facing response."
        ),
        expected_output=(
            "The safety-reviewed final response in markdown. "
            "Ends with [SAFETY: APPROVED] or [SAFETY: CORRECTED]."
        ),
        agent=safety_agent,
        context=[task_classify, task_synthesize],
    )

    # ── Build & kick off the Crew ─────────────────────────────────────────────
    crew = Crew(
        agents=[triage_agent, rag_agent, synthesis_agent, safety_agent],
        tasks=[task_classify, task_retrieve, task_synthesize, task_safety],
        process=Process.sequential,
        verbose=True,
    )

    logger.info(
        f"[ClynicxCrew] Kicking off crew | user={user_id} | consent={data_sharing_consent}"
    )
    result = crew.kickoff()
    # CrewAI 1.x returns CrewOutput with a .raw attribute
    raw_output = (result.raw or "").strip()

    # ── Strip safety tags from final output ───────────────────────────────────
    final_text = (
        raw_output
        .replace("[SAFETY: APPROVED]", "")
        .replace("[SAFETY: CORRECTED]", "")
        .strip()
    )

    # ── Parse Task 1 output to extract intent metadata ────────────────────────
    intent        = "general"
    agent_used    = "groq_only+crewai"
    sources: list = []
    consent_needed = False

    try:
        # CrewAI 1.x: TaskOutput.raw holds the raw string output
        classify_raw = (task_classify.output.raw if task_classify.output else "") or ""
        m = re.search(r'\{.*?\}', classify_raw, re.DOTALL)
        if m:
            classify_data = json.loads(m.group())
            intent = classify_data.get("intent", "general")
            if intent not in ("personal", "general", "off_topic"):
                intent = "general"
    except Exception as e:
        logger.warning(f"[ClynicxCrew] Could not parse triage output: {e}")

    # ── Parse Task 2 output for sources ──────────────────────────────────────
    if intent == "personal" and data_sharing_consent:
        agent_used = "mistral+groq+crewai"
        try:
            retrieve_raw = (task_retrieve.output.raw if task_retrieve.output else "") or ""
            m = re.search(r'\{.*\}', retrieve_raw, re.DOTALL)
            if m:
                retrieve_data = json.loads(m.group())
                sources = retrieve_data.get("sources", [])
        except Exception as e:
            logger.warning(f"[ClynicxCrew] Could not parse retrieval output: {e}")

    elif intent == "off_topic":
        agent_used = "off_topic_block"

    elif intent == "personal" and not data_sharing_consent:
        agent_used = "groq_only+crewai"
        consent_needed = True

    logger.info(
        f"[ClynicxCrew] Pipeline complete | intent={intent} | agent_used={agent_used} | "
        f"sources={len(sources)} | consent_needed={consent_needed}"
    )

    return AgentResponse(
        text=final_text,
        agent_used=agent_used,
        intent=intent,
        sources=sources,
        consent_needed=consent_needed,
    )


# ── Public async interface ────────────────────────────────────────────────────

async def run_crew(
    message: str,
    user_id: str,
    history: list,
    data_sharing_consent: bool,
) -> AgentResponse:
    """
    Async entry point for the CrewAI pipeline.
    Executes the synchronous crew in a thread pool to avoid blocking FastAPI's event loop.
    """
    return await asyncio.to_thread(
        _run_crew_sync, message, user_id, history, data_sharing_consent
    )
