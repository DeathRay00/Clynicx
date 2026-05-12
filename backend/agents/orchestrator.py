"""
agents/orchestrator.py — Multi-Agent Pipeline Orchestrator (CrewAI Edition)

Delegates to ClynicxMedicalCrew (agents/crew.py), a 4-agent CrewAI sequential
pipeline using Groq + Mistral:

  Agent 1 — TriageAgent     (Groq)   : Intent classification
  Agent 2 — RAGAgent        (Mistral): Document embedding + semantic retrieval
  Agent 3 — SynthesisAgent  (Groq)   : Medical response generation
  Agent 4 — SafetyAgent     (Groq)   : Response safety review & correction

Public interface is unchanged — chatbot.py router calls run_pipeline() exactly
as before; no API changes required.

Returns AgentResponse with:
    text          : Final patient-facing response (markdown)
    agent_used    : 'groq_only+crewai' | 'mistral+groq+crewai' | 'off_topic_block'
    intent        : 'personal' | 'general' | 'off_topic'
    sources       : List of source citations (from RAGAgent)
    consent_needed: True when user must enable data-sharing consent
"""
import logging
from dataclasses import dataclass, field

# Import the CrewAI crew as the primary pipeline
from agents.crew import run_crew, AgentResponse  # noqa: F401 — re-exported

logger = logging.getLogger(__name__)


async def run_pipeline(
    message: str,
    user_id: str,
    history: list[dict],
    data_sharing_consent: bool,
) -> AgentResponse:
    """
    Main entry point called by routers/chatbot.py.

    Delegates fully to the ClynicxMedicalCrew (CrewAI sequential pipeline).
    See agents/crew.py for full agent/task definitions.
    """
    logger.info(
        f"[Orchestrator] → ClynicxMedicalCrew | user={user_id} | consent={data_sharing_consent}"
    )
    return await run_crew(
        message=message,
        user_id=user_id,
        history=history,
        data_sharing_consent=data_sharing_consent,
    )
