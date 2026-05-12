"""
routers/analyze.py — Medical report AI analysis routes for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/routes/analyze.js.

Uses pdfplumber for PDF text extraction and Mistral AI via httpx.
Implements a server-side asyncio rate-limit queue identical to the original.

Endpoints:
    POST /analyze
    POST /analyze/extract-timeline
"""
import os
import io
import re
import json
import base64
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
import pdfplumber
from middleware.auth import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analyze", tags=["analyze"])

# ── Mistral configuration ─────────────────────────────────────────────────────
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-large-latest")
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"

# ── Rate-limit queue ──────────────────────────────────────────────────────────
QUEUE_INTERVAL_S = 2.0       # minimum gap between Mistral calls
RATE_LIMIT_PAUSE_S = 65.0    # pause when a 429 is received

_queue: asyncio.Queue = asyncio.Queue()
_last_call_at: float = 0.0
_rate_limited_until: float = 0.0
_queue_worker_started: bool = False


async def _queue_worker():
    global _last_call_at, _rate_limited_until
    while True:
        fn, future = await _queue.get()
        try:
            now = asyncio.get_event_loop().time()

            # Wait out rate-limit pause
            if now < _rate_limited_until:
                wait = _rate_limited_until - now + 0.5
                logger.info(f"[analyze] Rate-limit pause — waiting {wait:.1f}s")
                await asyncio.sleep(wait)

            # Enforce minimum gap
            now = asyncio.get_event_loop().time()
            gap = QUEUE_INTERVAL_S - (now - _last_call_at)
            if gap > 0:
                await asyncio.sleep(gap)

            _last_call_at = asyncio.get_event_loop().time()
            result = await fn()
            future.set_result(result)
        except Exception as exc:
            if isinstance(exc, MistralRateLimit):
                _rate_limited_until = asyncio.get_event_loop().time() + RATE_LIMIT_PAUSE_S
                logger.warning(f"[analyze] Mistral 429 — pausing {RATE_LIMIT_PAUSE_S}s")
            future.set_exception(exc)
        finally:
            _queue.task_done()


class MistralRateLimit(Exception):
    pass


async def _enqueue(fn) -> Any:
    global _queue_worker_started
    loop = asyncio.get_event_loop()
    if not _queue_worker_started:
        loop.create_task(_queue_worker())
        _queue_worker_started = True
    future: asyncio.Future = loop.create_future()
    await _queue.put((fn, future))
    return await future


# ── PDF text extraction ───────────────────────────────────────────────────────

def _extract_pdf_text(base64_data: str) -> str:
    try:
        pdf_bytes = base64.b64decode(base64_data)
        text_parts = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        return "\n".join(text_parts)
    except Exception as e:
        logger.warning(f"[analyze] PDF text extraction failed: {e}")
        return ""


def _preprocess_lab_text(raw_text: str) -> str:
    """
    Reconstruct columnar lab PDFs where text is extracted column-by-column.
    Mirrors the Node.js preprocessLabText() function.
    """
    lines = [l.rstrip() for l in raw_text.split("\n") if l.strip()]

    number_only = re.compile(
        r"^\s*[\d.,\-<>]+\s*(%|g/dL|mg/dL|U/L|mIU/L|mmol/L|IU/L|pg/mL|ng/mL|µg/dL|mEq/L|fL|mm/hr|cells/µL|10\^3/µL|10\^6/µL|seconds?|ratio)?\s*$",
        re.IGNORECASE,
    )
    ref_range = re.compile(
        r"^\s*[\d.,]+\s*[-–to]+\s*[\d.,]+\s*(%|g/dL|mg/dL|U/L|mIU/L|mmol/L|IU/L|pg/mL|ng/mL|µg/dL|mEq/L|fL|10\^3/µL|10\^6/µL)?\s*$",
        re.IGNORECASE,
    )

    annotated = []
    for line in lines:
        t = line.strip()
        if ref_range.match(t):
            annotated.append(("range", line))
        elif number_only.match(t):
            annotated.append(("value", line))
        elif re.search(r"\d", t) and re.search(r"[a-zA-Z]{3,}", t):
            annotated.append(("mixed", line))
        else:
            annotated.append(("name", line))

    max_value_run = cur_run = 0
    for kind, _ in annotated:
        cur_run = cur_run + 1 if kind == "value" else 0
        max_value_run = max(max_value_run, cur_run)

    if max_value_run >= 4:
        name_lines  = [l.strip() for k, l in annotated if k == "name"]
        value_lines = [l.strip() for k, l in annotated if k == "value"]
        range_lines = [l.strip() for k, l in annotated if k == "range"]
        mixed_lines = [l.strip() for k, l in annotated if k == "mixed"]
        rebuilt = []
        for i in range(max(len(name_lines), len(value_lines))):
            name  = name_lines[i]  if i < len(name_lines)  else ""
            val   = value_lines[i] if i < len(value_lines) else ""
            rng   = range_lines[i] if i < len(range_lines) else ""
            if name or val:
                rebuilt.append(f"{name}\t{val}\t{rng}")
        logger.info("[analyze] Column-shift detected — text reconstructed into row format")
        return "\n".join(rebuilt + [""] + mixed_lines)

    return "\n".join(lines)


# ── Mistral prompt ────────────────────────────────────────────────────────────
MISTRAL_PROMPT = """You are a medical AI assistant analyzing a medical report. Please analyze this medical report and provide:

1. A brief summary of the report
2. List all health parameters found with their values, units, and normal ranges
3. Identify any risk factors or abnormal values
4. Provide health recommendations based on the findings

Format your response as a JSON object with this exact structure:
{
  "summary": "Brief summary of the report",
  "reportType": "Type of report (e.g., Complete Blood Count, Lipid Profile, General Checkup)",
  "parameters": [
    {
      "name": "Parameter name",
      "value": "Measured value",
      "unit": "Unit of measurement",
      "normalRange": "Normal range",
      "status": "normal|low|high|critical",
      "category": "Category (Blood/Liver/Kidney/Lipid Profile/etc)"
    }
  ],
  "riskFactors": [
    {
      "severity": "low|medium|high|critical",
      "title": "Risk factor title",
      "description": "Detailed description",
      "recommendation": "What to do about it"
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Important:
- Mark status as "low" if below normal range, "high" if above normal range, "critical" if dangerously out of range
- Provide specific, actionable recommendations
- Use Indian medical standards and units (e.g., mg/dL for glucose)
- Return only valid JSON, no markdown code blocks"""


# ── JSON repair helper ────────────────────────────────────────────────────────

def _repair_json(json_str: str) -> str:
    repaired = json_str.strip()
    repaired = re.sub(r",\s*([}\]])", r"\1", repaired)

    open_b  = repaired.count("{")
    close_b = repaired.count("}")
    open_k  = repaired.count("[")
    close_k = repaired.count("]")

    if open_b == close_b and open_k == close_k:
        return repaired

    logger.warning("[analyze] JSON appears truncated. Attempting repair...")
    repaired = re.sub(r",\s*$", "", repaired)
    if repaired.count('"') % 2 != 0:
        repaired += '"'
    repaired += "]" * max(0, open_k - close_k)
    repaired += "}" * max(0, open_b - close_b)
    return repaired


# ── Mistral AI call ───────────────────────────────────────────────────────────

async def _call_ai_model(pdf_text: str, base64_data: str, mime_type: str, file_name: str) -> dict:
    use_text_mode = bool(pdf_text and pdf_text.strip())
    logger.info(f"[analyze] Mistral ({MISTRAL_MODEL}) — mode: {'text' if use_text_mode else 'inline'} — file: {file_name}")

    if use_text_mode:
        messages = [{"role": "user", "content": MISTRAL_PROMPT + "\n\nREPORT TEXT:\n" + pdf_text[:12000]}]
    else:
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": MISTRAL_PROMPT},
                {"type": "image_url", "image_url": f"data:{mime_type or 'application/pdf'};base64,{base64_data}"},
            ],
        }]

    body = {
        "model": MISTRAL_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 8192,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            MISTRAL_API_URL,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {MISTRAL_API_KEY}"},
            json=body,
        )

    if resp.status_code == 429:
        raise MistralRateLimit("Mistral rate limit (429)")
    if not resp.is_success:
        err_body = resp.json() if resp.content else {}
        err_msg = err_body.get("error", {}).get("message", resp.reason_phrase)
        raise HTTPException(status_code=resp.status_code, detail=f"Mistral API error: {resp.status_code} — {err_msg}")

    data = resp.json()
    full_response = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    logger.info(f"[analyze] Mistral response length: {len(full_response)}")

    if not full_response:
        raise ValueError("Empty response from AI API")

    # Extract JSON from markdown code block or raw
    json_str = full_response.strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", json_str)
    if code_block:
        json_str = code_block.group(1).strip()
    else:
        first_brace = json_str.find("{")
        last_brace  = json_str.rfind("}")
        if first_brace != -1:
            json_str = json_str[first_brace: last_brace + 1] if last_brace > first_brace else json_str[first_brace:]

    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        try:
            return json.loads(_repair_json(json_str))
        except json.JSONDecodeError as e:
            logger.error(f"[analyze] JSON parse failed. First 300 chars: {full_response[:300]}")
            raise ValueError(f"AI returned non-JSON response: {e}") from e


# ── Mock Analysis ─────────────────────────────────────────────────────────────

def _get_mock_analysis(file_name: str = "") -> dict:
    name = file_name.lower()
    is_blood  = "blood" in name or "cbc" in name
    is_lipid  = "lipid" in name or "cholesterol" in name

    if is_blood:
        return {
            "summary": "Complete Blood Count (CBC) report shows mostly normal parameters with slight elevation in white blood cell count, which may indicate a mild infection or inflammation.",
            "reportType": "Complete Blood Count (CBC)",
            "parameters": [
                {"name": "Hemoglobin",        "value": "14.2", "unit": "g/dL",    "normalRange": "13.0-17.0", "status": "normal", "category": "Blood"},
                {"name": "White Blood Cells", "value": "11.5", "unit": "×10³/μL", "normalRange": "4.0-10.0",  "status": "high",   "category": "Blood"},
                {"name": "Platelets",         "value": "250",  "unit": "×10³/μL", "normalRange": "150-400",   "status": "normal", "category": "Blood"},
                {"name": "Red Blood Cells",   "value": "4.8",  "unit": "×10⁶/μL", "normalRange": "4.5-5.5",   "status": "normal", "category": "Blood"},
            ],
            "riskFactors": [{
                "severity": "low",
                "title": "Elevated White Blood Cell Count",
                "description": "Your white blood cell count is slightly above the normal range at 11.5 ×10³/μL. This could indicate a mild infection, inflammation, or stress response.",
                "recommendation": "Monitor for symptoms like fever or fatigue. Consult your doctor if symptoms persist. Retest in 2-3 weeks if asymptomatic.",
            }],
            "recommendations": [
                "Stay well-hydrated and get adequate rest",
                "Monitor for any signs of infection (fever, pain, fatigue)",
                "Follow up with your doctor if WBC count remains elevated",
                "Maintain a balanced diet rich in vitamins and minerals",
            ],
        }

    if is_lipid:
        return {
            "summary": "Lipid profile shows elevated LDL cholesterol and total cholesterol levels, indicating increased cardiovascular risk. HDL cholesterol is within normal range.",
            "reportType": "Lipid Profile",
            "parameters": [
                {"name": "Total Cholesterol", "value": "220", "unit": "mg/dL", "normalRange": "<200", "status": "high",   "category": "Lipid Profile"},
                {"name": "LDL Cholesterol",   "value": "145", "unit": "mg/dL", "normalRange": "<100", "status": "high",   "category": "Lipid Profile"},
                {"name": "HDL Cholesterol",   "value": "48",  "unit": "mg/dL", "normalRange": ">40",  "status": "normal", "category": "Lipid Profile"},
                {"name": "Triglycerides",     "value": "165", "unit": "mg/dL", "normalRange": "<150", "status": "high",   "category": "Lipid Profile"},
            ],
            "riskFactors": [
                {"severity": "medium", "title": "High LDL Cholesterol",    "description": "Your LDL (bad) cholesterol is elevated at 145 mg/dL, which increases the risk of heart disease and stroke.", "recommendation": "Adopt a heart-healthy diet low in saturated fats, increase physical activity, and consider statin therapy if recommended by your doctor."},
                {"severity": "medium", "title": "Elevated Triglycerides",  "description": "Triglyceride levels are slightly above normal, which can contribute to atherosclerosis.", "recommendation": "Reduce sugar and refined carbohydrate intake, limit alcohol, and increase omega-3 fatty acids in your diet."},
            ],
            "recommendations": [
                "Follow a Mediterranean or DASH diet",
                "Exercise for at least 30 minutes, 5 days a week",
                "Limit saturated fats and trans fats",
                "Include more fiber-rich foods in your diet",
                "Consult a cardiologist for personalized treatment plan",
            ],
        }

    return {
        "summary": "General health checkup shows overall good health with some areas requiring attention. Blood sugar is slightly elevated, and vitamin D levels are low.",
        "reportType": "General Health Checkup",
        "parameters": [
            {"name": "Fasting Blood Sugar", "value": "108", "unit": "mg/dL", "normalRange": "70-100",   "status": "high",   "category": "Blood Sugar"},
            {"name": "Vitamin D",           "value": "18",  "unit": "ng/mL", "normalRange": "30-100",   "status": "low",    "category": "Vitamins"},
            {"name": "Hemoglobin",          "value": "14.5","unit": "g/dL",  "normalRange": "13.0-17.0","status": "normal", "category": "Blood"},
            {"name": "Creatinine",          "value": "0.9", "unit": "mg/dL", "normalRange": "0.6-1.2",  "status": "normal", "category": "Kidney"},
            {"name": "SGPT (ALT)",          "value": "32",  "unit": "U/L",   "normalRange": "7-56",      "status": "normal", "category": "Liver"},
        ],
        "riskFactors": [
            {"severity": "medium", "title": "Pre-Diabetic Blood Sugar Level", "description": "Fasting blood sugar at 108 mg/dL indicates pre-diabetes. This increases your risk of developing type 2 diabetes.", "recommendation": "Adopt lifestyle changes including regular exercise, weight management, and a low-glycemic diet. Monitor blood sugar regularly."},
            {"severity": "low",    "title": "Vitamin D Deficiency",           "description": "Low vitamin D levels can affect bone health, immune function, and mood.", "recommendation": "Increase sun exposure (15-20 minutes daily), consume vitamin D-rich foods, or take supplements as prescribed."},
        ],
        "recommendations": [
            "Get 30-45 minutes of daily exercise",
            "Reduce refined sugar and carbohydrate intake",
            "Take Vitamin D supplements (1000-2000 IU daily)",
            "Get 15-20 minutes of sun exposure daily",
            "Retest blood sugar in 3 months",
            "Schedule follow-up with your doctor",
        ],
    }


# ── Extract Health Timeline ───────────────────────────────────────────────────

def _extract_health_timeline(analysis: dict, report_id: str, report_date: str) -> list:
    trackable = {"Blood", "Blood Sugar", "Lipid Profile", "Kidney", "Liver"}
    params = analysis.get("parameters") or []
    return [
        {
            "id": f"timeline-{report_id}-{p['name'].lower().replace(' ', '-')}",
            "date": report_date,
            "type": "lab_result",
            "title": p["name"],
            "value": f"{p['value']} {p['unit']}",
            "normalRange": p.get("normalRange"),
            "status": p.get("status"),
            "category": p.get("category"),
            "reportId": report_id,
        }
        for p in params
        if p.get("category") in trackable
    ]


# ── Request Bodies ────────────────────────────────────────────────────────────

class AnalyzeBody(BaseModel):
    fileData: str
    mimeType: Optional[str] = "application/pdf"
    fileName: Optional[str] = ""


class TimelineBody(BaseModel):
    analysis: dict
    reportId: str
    reportDate: str


# ── POST /analyze ─────────────────────────────────────────────────────────────

@router.post("")
async def analyze_report(body: AnalyzeBody, user: dict = Depends(require_auth)):
    if not body.fileData:
        raise HTTPException(status_code=400, detail="fileData (base64) is required")

    analyzed_at = datetime.now(timezone.utc).isoformat()

    # No API key → return mock
    if not MISTRAL_API_KEY:
        logger.warning("MISTRAL_API_KEY missing - returning mock analysis")
        return {
            **_get_mock_analysis(body.fileName),
            "analyzedAt": analyzed_at,
            "isMockAnalysis": True,
            "errorMessage": "AI service not configured. Showing sample analysis based on report type.",
        }

    resolved_mime = body.mimeType or "application/pdf"

    # Step 1: Extract PDF text
    pdf_text = ""
    if resolved_mime == "application/pdf":
        raw_text = _extract_pdf_text(body.fileData)
        if raw_text.strip():
            pdf_text = _preprocess_lab_text(raw_text)
            logger.info(f"[analyze] PDF text: {len(raw_text)} raw → {len(pdf_text)} preprocessed chars")
        else:
            logger.info("[analyze] No text extracted (scanned PDF) — falling back to inline mode")
    else:
        supported_images = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
        if resolved_mime not in supported_images:
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported file type: {resolved_mime}. Supported: PDF, JPEG, PNG, WEBP.",
            )

    # Step 2: Send to Mistral via rate-limit queue
    file_name = body.fileName or "unknown"
    queue_len = _queue.qsize() + 1
    est_wait = int(queue_len * QUEUE_INTERVAL_S)
    logger.info(f"[analyze] Request queued for: {file_name} (queue depth: {queue_len}, est. wait: {est_wait}s)")

    try:
        analysis = await _enqueue(
            lambda: _call_ai_model(pdf_text, body.fileData, resolved_mime, file_name)
        )
        return {**analysis, "analyzedAt": analyzed_at, "isMockAnalysis": False}

    except MistralRateLimit:
        wait_sec = max(int(_rate_limited_until - asyncio.get_event_loop().time()), 65)
        return {
            **_get_mock_analysis(file_name),
            "analyzedAt": analyzed_at,
            "isMockAnalysis": True,
            "errorMessage": f"AI quota reached. Showing sample analysis. Real AI analysis will be available in ~{wait_sec} seconds.",
            "retryAfter": wait_sec,
        }
    except Exception as err:
        err_msg = str(err)
        logger.error(f"[analyze] Failed after retry: {err_msg}")

        if "401" in err_msg or "403" in err_msg:
            return {
                **_get_mock_analysis(file_name),
                "analyzedAt": analyzed_at,
                "isMockAnalysis": True,
                "errorMessage": "AI service authentication failed. Showing sample analysis. Please contact support.",
            }

        return {
            **_get_mock_analysis(file_name),
            "analyzedAt": analyzed_at,
            "isMockAnalysis": True,
            "errorMessage": "AI analysis failed. Showing sample analysis based on report type.",
        }


# ── POST /analyze/extract-timeline ───────────────────────────────────────────

@router.post("/extract-timeline")
def extract_timeline(body: TimelineBody, user: dict = Depends(require_auth)):
    if not body.analysis or not body.reportId or not body.reportDate:
        raise HTTPException(status_code=400, detail="analysis, reportId, and reportDate are required")
    entries = _extract_health_timeline(body.analysis, body.reportId, body.reportDate)
    return {"timelineEntries": entries}
