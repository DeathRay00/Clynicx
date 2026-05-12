"""
routers/prescriptions.py — Prescription CRUD routes for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/routes/prescriptions.js.

Endpoints:
    GET  /prescriptions
    GET  /prescriptions/{prescription_id}
    POST /prescriptions
"""
import uuid
import json
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db import query
from middleware.auth import require_auth

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


def _map_prescription(row: dict) -> dict:
    medicines = row.get("medicines") or []
    lab_tests = row.get("lab_tests") or []

    # psycopg2 returns JSONB as a Python object already; handle string case too
    if isinstance(medicines, str):
        try:
            medicines = json.loads(medicines)
        except Exception:
            medicines = []
    if isinstance(lab_tests, str):
        try:
            lab_tests = json.loads(lab_tests)
        except Exception:
            lab_tests = []

    follow_up = row.get("follow_up_date")
    if follow_up is not None:
        follow_up = str(follow_up)

    return {
        "id": str(row["id"]),
        "patientId": str(row["patient_id"]),
        "doctorId": str(row["doctor_id"]),
        "patientName": row.get("patient_name"),
        "doctorName": row.get("doctor_name"),
        "doctorSpecialization": row.get("doctor_specialization"),
        "diagnosis": row.get("diagnosis"),
        "medicines": medicines,
        "labTests": lab_tests,
        "instructions": row.get("instructions"),
        "followUpDate": follow_up,
        "consultationFee": row.get("consultation_fee"),
        "status": row.get("status"),
        "prescribedDate": str(row["prescribed_date"]) if row.get("prescribed_date") else None,
        "createdAt": str(row["created_at"]) if row.get("created_at") else None,
    }


# ── Request Body ──────────────────────────────────────────────────────────────

class CreatePrescriptionBody(BaseModel):
    patientId: str
    patientName: Optional[str] = None
    diagnosis: Optional[str] = None
    medicines: Optional[List[Any]] = []
    labTests: Optional[List[Any]] = []
    instructions: Optional[str] = None
    followUpDate: Optional[str] = None
    consultationFee: Optional[Any] = None


# ── GET /prescriptions ────────────────────────────────────────────────────────

@router.get("")
def list_prescriptions(user: dict = Depends(require_auth)):
    if user["role"] == "patient":
        rows = query(
            "SELECT * FROM prescriptions WHERE patient_id = %s ORDER BY prescribed_date DESC",
            (user["id"],),
        )
    elif user["role"] == "doctor":
        rows = query(
            "SELECT * FROM prescriptions WHERE doctor_id = %s ORDER BY prescribed_date DESC",
            (user["id"],),
        )
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    prescriptions = [_map_prescription(r) for r in rows]
    return {
        "prescriptions": prescriptions,
        "totalCount": len(prescriptions),
        "activeCount": sum(1 for p in prescriptions if p["status"] == "active"),
        "completedCount": sum(1 for p in prescriptions if p["status"] == "completed"),
    }


# ── GET /prescriptions/{prescription_id} ─────────────────────────────────────

@router.get("/{prescription_id}")
def get_prescription(prescription_id: str, user: dict = Depends(require_auth)):
    rows = query("SELECT * FROM prescriptions WHERE id = %s", (prescription_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Prescription not found")

    p = rows[0]
    if str(p["patient_id"]) != str(user["id"]) and str(p["doctor_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Unauthorized")

    return _map_prescription(p)


# ── POST /prescriptions ───────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_prescription(body: CreatePrescriptionBody, user: dict = Depends(require_auth)):
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can create prescriptions")
    if not body.patientId:
        raise HTTPException(status_code=400, detail="patientId is required")

    presc_id = str(uuid.uuid4())
    rows = query(
        """
        INSERT INTO prescriptions (
            id, patient_id, doctor_id, patient_name, doctor_name, doctor_specialization,
            diagnosis, medicines, lab_tests, instructions, follow_up_date, consultation_fee, status
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active')
        RETURNING *
        """,
        (
            presc_id,
            body.patientId,
            str(user["id"]),
            body.patientName,
            user["full_name"],
            user.get("specialization") or "General Physician",
            body.diagnosis,
            json.dumps(body.medicines or []),
            json.dumps(body.labTests or []),
            body.instructions,
            body.followUpDate,
            body.consultationFee,
        ),
    )

    return {"success": True, "prescription": _map_prescription(rows[0])}
