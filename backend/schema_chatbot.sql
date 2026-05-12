-- ============================================================
-- Clynicx Chatbot Schema Migration
-- Run once to add chatbot tables and pgvector extension
-- ============================================================

-- Enable pgvector extension (required for embedding storage)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── chat_sessions ──────────────────────────────────────────
-- Tracks per-user consent and session metadata.
-- data_sharing_consent: when TRUE, Agent 1 (Mistral) is
-- allowed to embed and retrieve the user's medical reports.
CREATE TABLE IF NOT EXISTS chat_sessions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_sharing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

-- ── chat_messages ──────────────────────────────────────────
-- Stores individual messages in each chat session.
-- agent_used: 'groq_only' | 'mistral+groq' | 'off_topic_block' | 'error'
-- sources   : JSON array of {type, id, preview, metadata} from Agent 1
-- intent    : classified intent from Agent 2 (Groq)
CREATE TABLE IF NOT EXISTS chat_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content    TEXT NOT NULL,
    agent_used TEXT,
    sources    JSONB DEFAULT '[]',
    intent     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at DESC);

-- ── patient_embeddings ─────────────────────────────────────
-- Vector store for patient medical data (Agent 1 / Mistral).
-- Stores 1024-dim embeddings from mistral-embed model.
-- Used for cosine similarity retrieval when a patient asks
-- personal questions with data_sharing_consent = TRUE.
CREATE TABLE IF NOT EXISTS patient_embeddings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,   -- 'report' or 'prescription'
    source_id   TEXT NOT NULL,   -- UUID of the report/prescription
    chunk_text  TEXT NOT NULL,
    embedding   vector(1024),    -- mistral-embed output dimension
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, source_type, source_id)
);

-- IVFFlat index for approximate nearest-neighbour cosine search
-- (faster than exact search for large datasets)
CREATE INDEX IF NOT EXISTS idx_patient_emb_vec
    ON patient_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_patient_emb_user
    ON patient_embeddings(user_id);
