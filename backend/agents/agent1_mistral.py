"""
agents/agent1_mistral.py — Agent 1: RAG & Embedding Agent (Mistral AI)

Responsibilities:
  - Embed text using mistral-embed model
  - Chunk patient reports/prescriptions into searchable segments
  - Store embeddings in PostgreSQL (patient_embeddings table via pgvector)
  - Retrieve top-K relevant chunks via cosine similarity
  - Returns structured context for Agent 2 to synthesize

This agent is ONLY activated when:
  1. The user has given consent (data_sharing_consent = True)
  2. Agent 2 classifies the intent as 'personal'
"""
import os
import json
import logging
from typing import Optional
import httpx
from db import query

logger = logging.getLogger(__name__)

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_EMBED_MODEL = os.getenv("MISTRAL_EMBED_MODEL", "mistral-embed")
MISTRAL_EMBED_URL = "https://api.mistral.ai/v1/embeddings"

CHUNK_SIZE = 600      # characters per chunk
CHUNK_OVERLAP = 80    # overlap between chunks
TOP_K = 5             # number of chunks to retrieve


# ── Text chunking ─────────────────────────────────────────────────────────────

def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks for better RAG recall."""
    text = text.strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end].strip())
        if end == len(text):
            break
        start += size - overlap
    return [c for c in chunks if c]


# ── Embed via Mistral API ─────────────────────────────────────────────────────

async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of texts using mistral-embed.
    Returns list of 1024-dim float vectors.
    Falls back to empty vectors if API key missing.
    """
    if not MISTRAL_API_KEY:
        logger.warning("[Agent1/Mistral] MISTRAL_API_KEY not set — returning zero vectors")
        return [[0.0] * 1024 for _ in texts]

    if not texts:
        return []

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            MISTRAL_EMBED_URL,
            headers={
                "Authorization": f"Bearer {MISTRAL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": MISTRAL_EMBED_MODEL, "input": texts},
        )

    if not resp.is_success:
        logger.error(f"[Agent1/Mistral] Embed API error {resp.status_code}: {resp.text[:300]}")
        return [[0.0] * 1024 for _ in texts]

    data = resp.json()
    return [item["embedding"] for item in data.get("data", [])]


async def embed_single(text: str) -> list[float]:
    """Embed a single text string."""
    results = await embed_texts([text])
    return results[0] if results else [0.0] * 1024


# ── Patient data builder ──────────────────────────────────────────────────────

def _build_report_text(report: dict) -> str:
    """Convert a medical report row into searchable text."""
    parts = [f"Medical Report — Type: {report.get('report_type', 'Unknown')}"]
    if report.get("lab_name"):
        parts.append(f"Lab: {report['lab_name']}")
    if report.get("upload_date"):
        parts.append(f"Date: {report['upload_date']}")
    ai = report.get("ai_analysis")
    if ai:
        if isinstance(ai, str):
            try:
                ai = json.loads(ai)
            except Exception:
                parts.append(f"Analysis: {ai}")
                return "\n".join(parts)
        if isinstance(ai, dict):
            if ai.get("summary"):
                parts.append(f"Summary: {ai['summary']}")
            if ai.get("reportType"):
                parts.append(f"Report Type: {ai['reportType']}")
            for p in (ai.get("parameters") or []):
                line = f"- {p.get('name','')}: {p.get('value','')} {p.get('unit','')} (Normal: {p.get('normalRange','')}, Status: {p.get('status','')})"
                parts.append(line)
            for rf in (ai.get("riskFactors") or []):
                parts.append(f"Risk: {rf.get('title','')} [{rf.get('severity','')}] — {rf.get('description','')}")
            for rec in (ai.get("recommendations") or []):
                parts.append(f"Recommendation: {rec}")
    return "\n".join(parts)


def _build_prescription_text(presc: dict) -> str:
    """Convert a prescription row into searchable text."""
    parts = [f"Prescription — Doctor: {presc.get('doctor_name','Unknown')}"]
    if presc.get("prescribed_date"):
        parts.append(f"Date: {presc['prescribed_date']}")
    if presc.get("diagnosis"):
        parts.append(f"Diagnosis: {presc['diagnosis']}")
    medicines = presc.get("medicines") or []
    if isinstance(medicines, str):
        try:
            medicines = json.loads(medicines)
        except Exception:
            medicines = []
    for med in medicines:
        if isinstance(med, dict):
            parts.append(f"Medicine: {med.get('name','')} {med.get('dosage','')} — {med.get('frequency','')} for {med.get('duration','')}")
        else:
            parts.append(f"Medicine: {med}")
    if presc.get("instructions"):
        parts.append(f"Instructions: {presc['instructions']}")
    if presc.get("doctor_specialization"):
        parts.append(f"Specialization: {presc['doctor_specialization']}")
    return "\n".join(parts)


# ── Embed & Store patient data ────────────────────────────────────────────────

async def embed_and_store_patient_data(user_id: str) -> int:
    """
    Fetch patient's reports + prescriptions, chunk them, embed via Mistral,
    and upsert into patient_embeddings table.
    Returns number of chunks stored.
    """
    logger.info(f"[Agent1/Mistral] Embedding patient data for user {user_id}")

    # Fetch reports
    reports = query(
        "SELECT * FROM medical_reports WHERE patient_id = %s ORDER BY upload_date DESC LIMIT 10",
        (user_id,),
    )
    # Fetch prescriptions
    prescriptions = query(
        "SELECT * FROM prescriptions WHERE patient_id = %s ORDER BY prescribed_date DESC LIMIT 10",
        (user_id,),
    )

    documents: list[dict] = []

    for r in reports:
        text = _build_report_text(r)
        if text.strip():
            for i, chunk in enumerate(_chunk_text(text)):
                documents.append({
                    "source_type": "report",
                    "source_id": str(r["id"]),
                    "chunk_index": i,
                    "text": chunk,
                    "metadata": {
                        "report_type": r.get("report_type"),
                        "lab_name": r.get("lab_name"),
                        "upload_date": str(r.get("upload_date", "")),
                    },
                })

    for p in prescriptions:
        text = _build_prescription_text(p)
        if text.strip():
            for i, chunk in enumerate(_chunk_text(text)):
                documents.append({
                    "source_type": "prescription",
                    "source_id": str(p["id"]),
                    "chunk_index": i,
                    "text": chunk,
                    "metadata": {
                        "doctor_name": p.get("doctor_name"),
                        "diagnosis": p.get("diagnosis"),
                        "prescribed_date": str(p.get("prescribed_date", "")),
                    },
                })

    if not documents:
        logger.info(f"[Agent1/Mistral] No documents to embed for user {user_id}")
        return 0

    # Embed in batches of 10
    batch_size = 10
    total_stored = 0
    for i in range(0, len(documents), batch_size):
        batch = documents[i : i + batch_size]
        texts = [d["text"] for d in batch]
        vectors = await embed_texts(texts)

        for doc, vec in zip(batch, vectors):
            vec_str = "[" + ",".join(str(v) for v in vec) + "]"
            query(
                """
                INSERT INTO patient_embeddings
                    (user_id, source_type, source_id, chunk_text, embedding, metadata)
                VALUES (%s, %s, %s, %s, %s::vector, %s)
                ON CONFLICT (user_id, source_type, source_id)
                DO UPDATE SET
                    chunk_text = EXCLUDED.chunk_text,
                    embedding  = EXCLUDED.embedding,
                    metadata   = EXCLUDED.metadata,
                    created_at = NOW()
                """,
                (
                    user_id,
                    doc["source_type"],
                    doc["source_id"],
                    doc["text"],
                    vec_str,
                    json.dumps(doc["metadata"]),
                ),
            )
            total_stored += 1

    logger.info(f"[Agent1/Mistral] Stored {total_stored} chunks for user {user_id}")
    return total_stored


# ── Retrieve relevant context ─────────────────────────────────────────────────

async def retrieve_context(user_id: str, refined_query: str, top_k: int = TOP_K) -> dict:
    """
    Embed the refined_query (from Agent 2), then do cosine similarity search
    against the patient's stored embeddings.

    Returns:
        {
          "context_text": str,       # concatenated chunks for prompt injection
          "sources": [               # for UI citation display
              {"type": "report"|"prescription", "id": str, "preview": str, "metadata": dict}
          ]
        }
    """
    logger.info(f"[Agent1/Mistral] Retrieving context for user {user_id}, query: {refined_query[:80]}")

    query_vec = await embed_single(refined_query)
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"

    rows = query(
        """
        SELECT source_type, source_id, chunk_text, metadata,
               1 - (embedding <=> %s::vector) AS similarity
        FROM patient_embeddings
        WHERE user_id = %s
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (vec_str, user_id, vec_str, top_k),
    )

    if not rows:
        return {"context_text": "", "sources": []}

    sources = []
    context_parts = []
    seen_source_ids = set()

    for i, row in enumerate(rows):
        sim = float(row.get("similarity", 0))
        if sim < 0.3:   # skip very low similarity matches
            continue
        context_parts.append(
            f"[Source {i+1} — {row['source_type'].title()} | similarity {sim:.2f}]\n{row['chunk_text']}"
        )
        src_id = row["source_id"]
        if src_id not in seen_source_ids:
            seen_source_ids.add(src_id)
            meta = row.get("metadata") or {}
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            sources.append({
                "type": row["source_type"],
                "id": src_id,
                "preview": row["chunk_text"][:120] + "...",
                "metadata": meta,
            })

    context_text = "\n\n---\n\n".join(context_parts)
    logger.info(f"[Agent1/Mistral] Retrieved {len(rows)} chunks, {len(sources)} unique sources")
    return {"context_text": context_text, "sources": sources}
