"""
main.py — FastAPI application entry point for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/index.js.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 3001 --reload
"""
import os
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

# ── Import routers ────────────────────────────────────────────────────────────
from routers.auth          import router as auth_router
from routers.doctors       import router as doctors_router
from routers.appointments  import router as appointments_router
from routers.prescriptions import router as prescriptions_router
from routers.reports       import router as reports_router
from routers.analyze       import router as analyze_router
from routers.dashboard     import router as dashboard_router   # /patient/*
from routers.patients      import router as patients_router    # /doctor/*
from routers.chatbot       import router as chatbot_router     # /chatbot/*

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
PORT = int(os.getenv("PORT", "3001"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    print(f"\n🚀 Clynicx Python backend running on http://localhost:{PORT}")
    print("📋 API Endpoints:")
    print("   GET  /health")
    print("   POST /auth/signup")
    print("   POST /auth/login")
    print("   GET  /auth/profile")
    print("   GET  /doctors")
    print("   GET  /appointments")
    print("   POST /appointments")
    print("   GET  /prescriptions")
    print("   GET  /reports")
    print("   GET  /patient/dashboard")
    print("   GET  /doctor/dashboard")
    print("   POST /analyze")
    print("   POST /chatbot/message  (Multi-Agent: Groq + Mistral RAG)")
    print("   GET  /chatbot/session")
    print("   POST /chatbot/consent\n")
    yield
    # shutdown


app = FastAPI(
    title="Clynicx API",
    description="Clinical management system backend (Python/FastAPI)",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

# ── Request logging middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    logger.info(f"[{request.method}] {request.url.path}")
    response = await call_next(request)
    elapsed = (time.time() - start) * 1000
    logger.info(f"[{request.method}] {request.url.path} → {response.status_code} ({elapsed:.1f}ms)")
    return response

# ── Body size limit (70 MB) ───────────────────────────────────────────────────
# FastAPI/Starlette doesn't have a built-in body-size limit middleware by default.
# We enforce it via a simple middleware.
MAX_BODY_SIZE = 70 * 1024 * 1024  # 70 MB


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(status_code=413, content={"error": "Request body too large (max 70 MB)"})
    return await call_next(request)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
def health():
    from datetime import datetime, timezone
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


app.include_router(auth_router)
app.include_router(doctors_router)
app.include_router(appointments_router)
app.include_router(prescriptions_router)
app.include_router(reports_router)
app.include_router(analyze_router)
app.include_router(dashboard_router)   # prefix=/patient
app.include_router(patients_router)    # prefix=/doctor
app.include_router(chatbot_router)     # prefix=/chatbot

# ── 404 handler ───────────────────────────────────────────────────────────────
@app.exception_handler(404)
async def not_found(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": f"Route not found: {request.method} {request.url.path}"},
    )

# ── Generic error handler ─────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_error(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "details": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
