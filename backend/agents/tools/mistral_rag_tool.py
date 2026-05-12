"""
agents/tools/mistral_rag_tool.py — CrewAI Tools for Mistral RAG

Wraps the existing agent1_mistral embed/retrieve functions as CrewAI BaseTool
objects so the RAGAgent can call them declaratively in a Task.

Both tools run async code synchronously using a fresh event loop since CrewAI
crews are executed in a thread via asyncio.to_thread().
"""
import asyncio
import json
import logging
from typing import Type

from pydantic import BaseModel, Field
from crewai.tools import BaseTool

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Create a fresh event loop and run the coroutine. Safe inside threads."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ── Input schemas ─────────────────────────────────────────────────────────────

class EmbedderInput(BaseModel):
    user_id: str = Field(..., description="The patient's user ID whose documents need to be embedded")


class RetrieverInput(BaseModel):
    user_id: str = Field(..., description="The patient's user ID")
    query: str = Field(..., description="Refined search query for semantic similarity lookup")


# ── Tool 1: Embed patient data ────────────────────────────────────────────────

class PatientDataEmbedderTool(BaseTool):
    name: str = "patient_data_embedder"
    description: str = (
        "Embeds the patient's medical reports and prescriptions into a pgvector "
        "database using Mistral AI embeddings (mistral-embed model). "
        "Must be called BEFORE patient_data_retriever. "
        "Input: user_id (the authenticated patient's ID)."
    )
    args_schema: Type[BaseModel] = EmbedderInput

    def _run(self, user_id: str) -> str:
        logger.info(f"[PatientDataEmbedderTool] Embedding documents for user={user_id}")
        try:
            from agents.agent1_mistral import embed_and_store_patient_data
            count = _run_async(embed_and_store_patient_data(user_id))
            logger.info(f"[PatientDataEmbedderTool] Stored {count} chunks for user={user_id}")
            return f"Successfully embedded {count} document chunks for patient {user_id} into the vector database."
        except Exception as e:
            logger.error(f"[PatientDataEmbedderTool] Error: {e}")
            return f"Embedding failed: {e}. Proceeding with empty context."


# ── Tool 2: Retrieve patient context ─────────────────────────────────────────

class PatientDataRetrieverTool(BaseTool):
    name: str = "patient_data_retriever"
    description: str = (
        "Retrieves the most relevant medical record chunks from the patient's "
        "pgvector database using cosine similarity search. "
        "Returns context_text (concatenated chunks) and sources (list of citations). "
        "Inputs: user_id, query (refined search terms from the triage agent)."
    )
    args_schema: Type[BaseModel] = RetrieverInput

    def _run(self, user_id: str, query: str) -> str:
        logger.info(f"[PatientDataRetrieverTool] Auto-embedding and retrieving context for user={user_id}, query={query[:60]}")
        try:
            from agents.agent1_mistral import retrieve_context, embed_and_store_patient_data
            # Auto-embed first to ensure latest records are indexed
            _run_async(embed_and_store_patient_data(user_id))
            
            result = _run_async(retrieve_context(user_id, query))
            logger.info(
                f"[PatientDataRetrieverTool] Retrieved {len(result.get('sources', []))} sources"
            )
            return json.dumps(result)
        except Exception as e:
            logger.error(f"[PatientDataRetrieverTool] Error: {e}")
            return json.dumps({"context_text": "", "sources": [], "error": str(e)})
