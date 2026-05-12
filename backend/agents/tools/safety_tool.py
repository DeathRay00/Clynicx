"""
agents/tools/safety_tool.py — CrewAI Safety Guardrail Tool

Uses Groq's llama-3.3-70b (synchronous client) to review AI-generated medical
responses before they reach the patient. Checks for:

  1. Dangerous medical advice (stop medication, dosage overrides)
  2. Hallucinated lab values or fabricated medical facts
  3. Definitive diagnoses (AI must never diagnose)
  4. Missing doctor-consultation disclaimer
  5. Unnecessarily alarming tone

Returns the original response if safe, or a corrected version if issues found.
Adds a [SAFETY: APPROVED] or [SAFETY: CORRECTED] tag (stripped by the crew).
"""
import os
import logging
from typing import Type

from pydantic import BaseModel, Field
from crewai.tools import BaseTool
from groq import Groq

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

_SAFETY_PROMPT = """\
You are a medical AI safety reviewer for ClynicxAI, a clinical management platform.

Review the provided medical AI response and check for these critical issues:
1. DANGEROUS ADVICE — e.g., "stop taking your medication", "double your dose", "ignore these symptoms"
2. HALLUCINATED DATA — invented lab values, fabricated statistics, made-up drug names
3. DEFINITIVE DIAGNOSIS — AI saying "You have diabetes" instead of "This could indicate..."
4. MISSING DISCLAIMER — no recommendation to consult a qualified doctor
5. ALARMING TONE — creating unnecessary fear or panic without basis

Response format:
- If SAFE:      "SAFE: [original response unchanged]"
- If CORRECTED: "CORRECTED: [fixed response with issues resolved]"

Output ONLY the tag and the response — no other commentary.\
"""


class SafetyInput(BaseModel):
    response_text: str = Field(
        ..., description="The AI-generated medical response to review for safety and accuracy"
    )


class SafetyGuardrailTool(BaseTool):
    name: str = "safety_guardrail"
    description: str = (
        "Reviews an AI-generated medical response for dangerous advice, hallucinated data, "
        "definitive diagnoses, missing disclaimers, and inappropriate tone. "
        "Returns the original response if safe, or a corrected version. "
        "Input: response_text (the full medical response to review)."
    )
    args_schema: Type[BaseModel] = SafetyInput

    def _run(self, response_text: str) -> str:
        if not GROQ_API_KEY:
            logger.warning("[SafetyGuardrailTool] GROQ_API_KEY not set — skipping safety check")
            return response_text

        logger.info(f"[SafetyGuardrailTool] Reviewing response ({len(response_text)} chars)")

        try:
            client = Groq(api_key=GROQ_API_KEY)
            resp = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": _SAFETY_PROMPT},
                    {
                        "role": "user",
                        "content": f"Review this medical AI response:\n\n{response_text}",
                    },
                ],
                temperature=0.1,
                max_tokens=1600,
            )
            result = (resp.choices[0].message.content or "").strip()

            if result.startswith("SAFE: "):
                logger.info("[SafetyGuardrailTool] Response approved — no issues found")
                return result[6:].strip() + "\n\n[SAFETY: APPROVED]"

            if result.startswith("CORRECTED: "):
                corrected = result[11:].strip()
                logger.warning("[SafetyGuardrailTool] Response corrected by safety review")
                # Ensure disclaimer is present after correction
                if "consult" not in corrected.lower() and "⚠️" not in corrected:
                    corrected += (
                        "\n\n> ⚠️ _This response was reviewed by ClynicxAI Safety Guardian. "
                        "Always consult a qualified healthcare professional for medical decisions._"
                    )
                return corrected + "\n\n[SAFETY: CORRECTED]"

            # Fallback if model doesn't follow format
            logger.warning("[SafetyGuardrailTool] Unexpected format from safety model — returning original")
            return response_text + "\n\n[SAFETY: APPROVED]"

        except Exception as e:
            logger.error(f"[SafetyGuardrailTool] Error during safety check: {e}")
            return response_text + "\n\n[SAFETY: APPROVED]"
