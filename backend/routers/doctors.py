"""
routers/doctors.py — Doctor listing routes for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/routes/doctors.js.

Endpoints:
    GET /doctors
    GET /doctors/{doctor_id}
"""
from fastapi import APIRouter, HTTPException
from db import query

router = APIRouter(prefix="/doctors", tags=["doctors"])


def _map_doctor(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "name": row["name"],
        "specialization": row["specialization"],
        "experience": row["experience"],
        "rating": float(row["rating"]) if row["rating"] is not None else None,
        "consultationFee": row["consultationfee"],
        "hospital": row["hospital"],
        "phone": row["phone"],
        "qualifications": row["qualifications"],
        "availableSlots": row["availableslots"],
        "availableDays": row["availabledays"],
        "createdAt": str(row["createdat"]) if row["createdat"] else None,
        "isActive": row["isactive"],
    }


# ── GET /doctors ──────────────────────────────────────────────────────────────

@router.get("")
def list_doctors():
    rows = query(
        """
        SELECT id, email,
               full_name AS name,
               specialization, years_of_experience AS experience, 4.8 AS rating,
               consultation_fee AS consultationfee,
               hospital_name AS hospital, phone, medical_license_number AS qualifications,
               '["09:00 AM", "02:00 PM", "04:00 PM"]'::json AS availableslots,
               '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]'::json  AS availabledays,
               created_at AS createdat,
               TRUE AS isactive
        FROM users
        WHERE role = 'doctor'
        ORDER BY created_at DESC
        """
    )
    return {"doctors": [_map_doctor(r) for r in rows]}


# ── GET /doctors/{doctor_id} ──────────────────────────────────────────────────

@router.get("/{doctor_id}")
def get_doctor(doctor_id: str):
    rows = query(
        """
        SELECT id, email,
               full_name AS name,
               specialization, years_of_experience AS experience, 4.8 AS rating,
               consultation_fee AS consultationfee,
               hospital_name AS hospital, phone, medical_license_number AS qualifications,
               '["09:00 AM", "02:00 PM", "04:00 PM"]'::json AS availableslots,
               '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]'::json  AS availabledays,
               created_at AS createdat,
               TRUE  AS isactive
        FROM users
        WHERE id = %s AND role = 'doctor'
        """,
        (doctor_id,),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"doctor": _map_doctor(rows[0])}
