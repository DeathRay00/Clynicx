"""
agents/agent2_groq.py — Agent 2: Medical Intelligence Agent (Groq AI)

Uses Groq's llama-3.3-70b-versatile for ultra-fast inference.

Responsibilities:
  1. classify_intent()  — decides if message is 'personal', 'general', or 'off_topic'
                          AND extracts a refined search query for Agent 1
  2. answer_general()   — pure medical Q&A without any patient data
  3. synthesize()       — final answer using context retrieved by Agent 1

The Agent 2 ↔ Agent 1 handshake:
  Agent 2 → classify_intent → produces refined_rag_query
  Agent 1 → retrieve_context(refined_rag_query) → produces context_text + sources
  Agent 2 → synthesize(context_text) → produces final grounded answer
"""
import os
import json
import logging
from typing import Optional
from groq import AsyncGroq

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

# ── System prompts ────────────────────────────────────────────────────────────

_SYSTEM_MEDICAL = """You are ClynicxAI, a professional medical assistant integrated into the Clynicx health platform.

Your role:
- Answer medical questions clearly and accurately
- Cover symptoms, diseases, medications, lab tests, diet, and general health advice
- Use simple, non-technical language when possible
- Always recommend consulting a qualified doctor for diagnosis or treatment decisions

Rules:
- ONLY answer medical and health-related questions
- If a question is NOT health-related, politely decline and redirect to medical topics
- Always append a brief disclaimer on AI medical advice
- Never diagnose definitively — guide, inform, and recommend professional consultation
- Keep responses concise but complete (aim for 150-300 words unless asked for more)"""

_SYSTEM_PERSONAL = """You are ClynicxAI, a personal medical assistant with access to the patient's own health records.

You have been given CONTEXT from the patient's actual medical data (reports, prescriptions).
Use this context to answer their question specifically and personally.

Rules:
- Ground your answer in the provided context first
- Clearly cite which report or prescription you are referencing
- If the context doesn't fully answer the question, supplement with general medical knowledge
- Never invent values or results that are not in the context
- Always recommend follow-up with their doctor for clinical decisions
- Append a brief disclaimer on AI medical advice"""

_INTENT_CLASSIFIER_PROMPT = """You are an intent classifier for a medical chatbot.

Classify the user's message into exactly one of these intents:
- "personal"   : The user is asking about THEIR OWN health data (e.g., "what do my reports say?", "summarize my prescriptions", "explain my test results", "what medications am I on?")
- "general"    : A general medical question not requiring personal data (e.g., "what is diabetes?", "what does hemoglobin mean?", "side effects of paracetamol?")
- "off_topic"  : Not a medical question at all (e.g., "what's the weather?", "who won the match?")

Also extract a refined search query ONLY if intent is "personal" — this will be used to search the patient's embedded medical documents.

Respond ONLY with valid JSON, no markdown:
{
  "intent": "personal" | "general" | "off_topic",
  "refined_rag_query": "specific search terms for semantic search (only if personal, else empty string)",
  "reason": "one-line explanation"
}"""


# ── Groq client factory ───────────────────────────────────────────────────────

def _get_client() -> Optional[AsyncGroq]:
    if not GROQ_API_KEY:
        return None
    return AsyncGroq(api_key=GROQ_API_KEY)


def _format_history(history: list[dict]) -> list[dict]:
    """Convert DB chat_messages rows to Groq message format."""
    return [
        {"role": msg["role"], "content": msg["content"]}
        for msg in history
        if msg["role"] in ("user", "assistant")
    ][-12:]   # last 6 exchanges


# ── Step 1: Intent classification ─────────────────────────────────────────────

async def classify_intent(message: str, history: list[dict]) -> dict:
    """
    Agent 2, Step 1: Classify intent and extract RAG search query.

    Returns:
        {
          "intent": "personal" | "general" | "off_topic",
          "refined_rag_query": str,
          "reason": str
        }
    """
    client = _get_client()

    if not client:
        logger.warning("[Agent2/Groq] GROQ_API_KEY not set — defaulting to 'general' intent")
        return {"intent": "general", "refined_rag_query": "", "reason": "No API key configured"}

    logger.info(f"[Agent2/Groq] Classifying intent: {message[:80]}")

    try:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _INTENT_CLASSIFIER_PROMPT},
                *_format_history(history[-4:]),   # last 2 exchanges for context
                {"role": "user", "content": message},
            ],
            temperature=0.1,
            max_tokens=256,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)

        intent = result.get("intent", "general")
        if intent not in ("personal", "general", "off_topic"):
            intent = "general"

        logger.info(f"[Agent2/Groq] Intent classified: {intent} | {result.get('reason','')}")
        return {
            "intent": intent,
            "refined_rag_query": result.get("refined_rag_query", message),
            "reason": result.get("reason", ""),
        }

    except Exception as e:
        logger.error(f"[Agent2/Groq] classify_intent error: {e}")
        return {"intent": "general", "refined_rag_query": message, "reason": "classification failed"}


# ── Step 2a: General medical answer (no patient data) ─────────────────────────

async def answer_general(message: str, history: list[dict]) -> str:
    """
    Agent 2, General Path: Answer medical questions without personal data.
    Falls back gracefully if Groq API key is missing.
    """
    client = _get_client()

    if not client:
        return (
            "I'm currently unable to connect to the AI service (Groq API key not configured). "
            "Please contact support or add your GROQ_API_KEY to the server environment.\n\n"
            "_This is a general medical assistant. Please consult a qualified doctor for personal advice._"
        )

    logger.info(f"[Agent2/Groq] Answering general medical question: {message[:80]}")

    try:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_MEDICAL},
                *_format_history(history),
                {"role": "user", "content": message},
            ],
            temperature=0.4,
            max_tokens=1024,
        )
        answer = response.choices[0].message.content or ""
        # Ensure disclaimer exists
        if "disclaimer" not in answer.lower() and "consult" not in answer.lower():
            answer += "\n\n> ⚠️ _This is AI-generated health information. Always consult a qualified healthcare professional for medical advice._"
        return answer

    except Exception as e:
        logger.error(f"[Agent2/Groq] answer_general error: {e}")
        return (
            "I encountered an error processing your question. Please try again.\n\n"
            "_If this persists, please check the server logs._"
        )


# ── Step 2b: Synthesize answer with patient context (Agent 1 → Agent 2) ───────

async def synthesize_with_context(
    message: str,
    history: list[dict],
    context_text: str,
    sources: list[dict],
) -> str:
    """
    Agent 2, Personal Path: Generate a grounded answer using context
    retrieved by Agent 1 (Mistral RAG).

    This is the Agent 1 → Agent 2 handoff point:
      Agent 1 provided: context_text (retrieved chunks) + sources list
      Agent 2 synthesizes: personalized, cited medical answer
    """
    client = _get_client()

    if not client:
        return (
            "I'm unable to connect to the AI service. "
            "Your data was retrieved successfully but synthesis requires the Groq API key.\n\n"
            "_Please add GROQ_API_KEY to the server environment._"
        )

    # Build the augmented user message with retrieved context
    if context_text:
        augmented_message = (
            f"PATIENT'S MEDICAL DATA CONTEXT (retrieved from their records):\n"
            f"{'='*60}\n"
            f"{context_text}\n"
            f"{'='*60}\n\n"
            f"PATIENT'S QUESTION: {message}"
        )
    else:
        augmented_message = (
            f"{message}\n\n"
            f"(Note: No relevant records were found in the patient's data for this query. "
            f"Please answer from general medical knowledge.)"
        )

    source_note = ""
    if sources:
        source_note = f"\n\nAvailable sources: {', '.join(s['type'] for s in sources)}"
        augmented_message += source_note

    logger.info(f"[Agent2/Groq] Synthesizing personal answer. Context length: {len(context_text)}, Sources: {len(sources)}")

    try:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PERSONAL},
                *_format_history(history),
                {"role": "user", "content": augmented_message},
            ],
            temperature=0.3,
            max_tokens=1200,
        )
        answer = response.choices[0].message.content or ""
        if "consult" not in answer.lower():
            answer += "\n\n> ⚠️ _AI analysis of your health records — please discuss findings with your doctor._"
        return answer

    except Exception as e:
        logger.error(f"[Agent2/Groq] synthesize_with_context error: {e}")
        return (
            "I encountered an error while analyzing your health records. Please try again.\n\n"
            "_Your data is safe — this is a temporary processing error._"
        )


# ── Off-topic rejection ───────────────────────────────────────────────────────

def off_topic_response() -> str:
    return (
        "I'm ClynicxAI, a medical assistant. I can only help with health and medical questions, such as:\n\n"
        "• Understanding symptoms or conditions\n"
        "• Information about medications or lab tests\n"
        "• Explaining your medical reports or prescriptions (with your consent)\n"
        "• General health and wellness advice\n\n"
        "Please ask a health-related question and I'll be happy to help! 🏥"
    )
