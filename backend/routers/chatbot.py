"""
routers/chatbot.py — Chatbot API routes for Clynicx Multi-Agent Medical Chatbot

Endpoints:
    GET  /chatbot/session          — Get current session + consent status
    POST /chatbot/session          — Create/reset session
    POST /chatbot/consent          — Toggle data sharing consent
    POST /chatbot/message          — Send a message (runs multi-agent pipeline)
    GET  /chatbot/history          — Get chat message history
    DELETE /chatbot/clear          — Clear chat history for current session

Multi-Agent Pipeline (per /chatbot/message):
    Agent 2 (Groq)    → classifies intent
    Agent 1 (Mistral) → embeds + retrieves patient data (if personal + consent)
    Agent 2 (Groq)    → synthesizes final answer
"""
import uuid
import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db import query
from middleware.auth import require_auth
from agents.orchestrator import run_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

HISTORY_LIMIT = 20   # messages to keep + send to LLM


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_session(user_id: str) -> dict:
    """Get existing session or create a new one for this user."""
    rows = query(
        "SELECT * FROM chat_sessions WHERE user_id = %s ORDER BY updated_at DESC LIMIT 1",
        (user_id,),
    )
    if rows:
        return rows[0]

    session_id = str(uuid.uuid4())
    rows = query(
        """
        INSERT INTO chat_sessions (id, user_id, data_sharing_consent)
        VALUES (%s, %s, FALSE)
        RETURNING *
        """,
        (session_id, user_id),
    )
    return rows[0]


def _get_history(session_id: str, limit: int = HISTORY_LIMIT) -> list[dict]:
    """Fetch recent chat messages for the session."""
    rows = query(
        """
        SELECT role, content, agent_used, sources, intent, created_at
        FROM chat_messages
        WHERE session_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (session_id, limit),
    )
    # Reverse to chronological order
    return list(reversed(rows))


def _save_message(session_id: str, role: str, content: str,
                  agent_used: str = None, sources: list = None, intent: str = None):
    """Persist a chat message to the database."""
    query(
        """
        INSERT INTO chat_messages (id, session_id, role, content, agent_used, sources, intent)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            str(uuid.uuid4()),
            session_id,
            role,
            content,
            agent_used,
            json.dumps(sources or []),
            intent,
        ),
    )
    # Touch session updated_at
    query(
        "UPDATE chat_sessions SET updated_at = NOW() WHERE id = %s",
        (session_id,),
    )


# ── Request/Response models ───────────────────────────────────────────────────

class SendMessageBody(BaseModel):
    message: str


class ConsentBody(BaseModel):
    consent: bool


# ── GET /chatbot/session ──────────────────────────────────────────────────────

@router.get("/session")
def get_session(user: dict = Depends(require_auth)):
    """Get the current chat session info and consent status."""
    session = _get_or_create_session(str(user["id"]))
    return {
        "sessionId": str(session["id"]),
        "dataSharingConsent": bool(session["data_sharing_consent"]),
        "createdAt": str(session["created_at"]),
        "updatedAt": str(session["updated_at"]),
        "userId": str(user["id"]),
        "userRole": user["role"],
    }


# ── POST /chatbot/session ─────────────────────────────────────────────────────

@router.post("/session", status_code=201)
def create_session(user: dict = Depends(require_auth)):
    """Create a new chat session (resets history for this user)."""
    session_id = str(uuid.uuid4())
    rows = query(
        """
        INSERT INTO chat_sessions (id, user_id, data_sharing_consent)
        VALUES (%s, %s, FALSE)
        RETURNING *
        """,
        (session_id, str(user["id"])),
    )
    session = rows[0]
    return {
        "sessionId": str(session["id"]),
        "dataSharingConsent": False,
        "message": "New session created",
    }


# ── POST /chatbot/consent ─────────────────────────────────────────────────────

@router.post("/consent")
def set_consent(body: ConsentBody, user: dict = Depends(require_auth)):
    """
    Toggle data sharing consent.
    When consent=True, Agent 1 (Mistral) will be allowed to access and embed
    the patient's reports and prescriptions for personalized answers.
    """
    session = _get_or_create_session(str(user["id"]))
    query(
        "UPDATE chat_sessions SET data_sharing_consent = %s, updated_at = NOW() WHERE id = %s",
        (body.consent, str(session["id"])),
    )
    action = "enabled" if body.consent else "disabled"
    logger.info(f"[Chatbot] User {user['id']} {action} data sharing consent")
    return {
        "success": True,
        "dataSharingConsent": body.consent,
        "message": (
            "Medical data access enabled. The AI can now analyze your reports and prescriptions."
            if body.consent
            else "Medical data access disabled. The AI will use general knowledge only."
        ),
    }


# ── GET /chatbot/history ──────────────────────────────────────────────────────

@router.get("/history")
def get_history(user: dict = Depends(require_auth)):
    """Get chat history for the user's current session."""
    session = _get_or_create_session(str(user["id"]))
    messages = _get_history(str(session["id"]), limit=HISTORY_LIMIT)

    formatted = []
    for m in messages:
        sources = m.get("sources") or []
        if isinstance(sources, str):
            try:
                sources = json.loads(sources)
            except Exception:
                sources = []
        formatted.append({
            "role": m["role"],
            "content": m["content"],
            "agentUsed": m.get("agent_used"),
            "intent": m.get("intent"),
            "sources": sources,
            "createdAt": str(m["created_at"]),
        })

    return {
        "sessionId": str(session["id"]),
        "dataSharingConsent": bool(session["data_sharing_consent"]),
        "messages": formatted,
        "totalMessages": len(formatted),
    }


# ── POST /chatbot/message ─────────────────────────────────────────────────────

@router.post("/message")
async def send_message(body: SendMessageBody, user: dict = Depends(require_auth)):
    """
    Main chat endpoint — runs the full multi-agent pipeline.

    Pipeline:
      1. Agent 2 (Groq)    → classify_intent
      2. Agent 1 (Mistral) → embed + retrieve (if personal + consent)
      3. Agent 2 (Groq)    → synthesize final answer
    """
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="Message too long (max 2000 characters)")

    # Get/create session
    session = _get_or_create_session(str(user["id"]))
    session_id = str(session["id"])
    consent = bool(session["data_sharing_consent"])

    # Fetch recent history for context
    history = _get_history(session_id, limit=12)

    # Save user message
    _save_message(session_id, "user", message)

    logger.info(
        f"[Chatbot] Message from user={user['id']} role={user['role']} "
        f"consent={consent} | '{message[:80]}'"
    )

    # ── Run the multi-agent pipeline ──────────────────────────────────────────
    try:
        result = await run_pipeline(
            message=message,
            user_id=str(user["id"]),
            history=history,
            data_sharing_consent=consent,
        )
    except Exception as e:
        logger.error(f"[Chatbot] Pipeline error: {e}")
        error_msg = (
            "I encountered an unexpected error. Please try again in a moment.\n\n"
            "_If the issue persists, please contact support._"
        )
        _save_message(session_id, "assistant", error_msg, agent_used="error")
        return {
            "reply": error_msg,
            "agentUsed": "error",
            "intent": "error",
            "sources": [],
            "dataSharingConsent": consent,
            "consentNeeded": False,
        }

    # Save assistant response
    _save_message(
        session_id,
        "assistant",
        result.text,
        agent_used=result.agent_used,
        sources=result.sources,
        intent=result.intent,
    )

    return {
        "reply": result.text,
        "agentUsed": result.agent_used,
        "intent": result.intent,
        "sources": result.sources,
        "dataSharingConsent": consent,
        "consentNeeded": result.consent_needed,
    }


# ── DELETE /chatbot/clear ─────────────────────────────────────────────────────

@router.delete("/clear")
def clear_history(user: dict = Depends(require_auth)):
    """Clear chat history and reset session."""
    session = _get_or_create_session(str(user["id"]))
    query("DELETE FROM chat_messages WHERE session_id = %s", (str(session["id"]),))
    query(
        "UPDATE chat_sessions SET updated_at = NOW() WHERE id = %s",
        (str(session["id"]),),
    )
    return {"success": True, "message": "Chat history cleared"}
