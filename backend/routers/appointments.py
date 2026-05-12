"""
routers/appointments.py — Appointment CRUD routes for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/routes/appointments.js.

Endpoints:
    GET    /appointments
    POST   /appointments
    PUT    /appointments/{appointment_id}
    DELETE /appointments/{appointment_id}
"""
import uuid
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db import query
from middleware.auth import require_auth

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _map_apt(row: dict) -> dict:
    apt_date = row.get("appointment_date")
    if isinstance(apt_date, (date, datetime)):
        apt_date = apt_date.isoformat()[:10]
    elif apt_date is not None:
        apt_date = str(apt_date)[:10]

    return {
        "id": str(row["id"]),
        "patientId": str(row["patient_id"]),
        "doctorId": str(row["doctor_id"]),
        "patientName": row.get("patient_name"),
        "patientEmail": row.get("patient_email"),
        "patientPhone": row.get("patient_phone"),
        "doctorName": row.get("doctor_name"),
        "specialization": row.get("doctor_specialization"),
        "hospitalName": row.get("hospital_name"),
        "doctorSpecialization": row.get("doctor_specialization"),
        "appointmentDate": apt_date,
        "appointmentTime": row.get("appointment_time"),
        "appointmentType": row.get("appointment_type"),
        "reasonForVisit": row.get("reason_for_visit"),
        "status": row.get("status"),
        "consultationFee": row.get("consultation_fee"),
        "notes": row.get("notes"),
        "bookedAt": str(row["booked_at"]) if row.get("booked_at") else None,
        "updatedAt": str(row["updated_at"]) if row.get("updated_at") else None,
        "isActive": row.get("is_active"),
    }


# ── Request Bodies ────────────────────────────────────────────────────────────

class BookAppointmentBody(BaseModel):
    doctorId: str
    appointmentDate: str
    appointmentTime: str
    appointmentType: Optional[str] = "in-person"
    reasonForVisit: Optional[str] = ""


class UpdateAppointmentBody(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


# ── GET /appointments ─────────────────────────────────────────────────────────

@router.get("")
def list_appointments(user: dict = Depends(require_auth)):
    today = date.today().isoformat()

    if user["role"] == "patient":
        rows = query(
            "SELECT * FROM appointments WHERE patient_id = %s ORDER BY appointment_date DESC, appointment_time DESC",
            (user["id"],),
        )
    elif user["role"] == "doctor":
        rows = query(
            "SELECT * FROM appointments WHERE doctor_id = %s ORDER BY appointment_date DESC, appointment_time DESC",
            (user["id"],),
        )
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    appointments = [_map_apt(r) for r in rows]
    return {
        "appointments": appointments,
        "totalCount": len(appointments),
        "upcomingCount": sum(1 for a in appointments if a["appointmentDate"] and a["appointmentDate"] >= today),
        "todayCount": sum(1 for a in appointments if a["appointmentDate"] == today),
        "completedCount": sum(1 for a in appointments if a["status"] == "completed"),
        "pendingCount": sum(1 for a in appointments if a["status"] == "pending"),
    }


# ── POST /appointments ────────────────────────────────────────────────────────

@router.post("", status_code=201)
def book_appointment(body: BookAppointmentBody, user: dict = Depends(require_auth)):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can book appointments")

    if not body.doctorId or not body.appointmentDate or not body.appointmentTime:
        raise HTTPException(
            status_code=400,
            detail="doctorId, appointmentDate, and appointmentTime are required",
        )

    # Get doctor info
    doctors = query(
        "SELECT id, full_name, specialization, hospital_name AS hospital, consultation_fee FROM users WHERE id = %s AND role = 'doctor'",
        (body.doctorId,),
    )
    if not doctors:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doctor = doctors[0]

    apt_id = str(uuid.uuid4())
    rows = query(
        """
        INSERT INTO appointments (
            id, patient_id, doctor_id,
            patient_name, patient_email, patient_phone,
            doctor_name, doctor_specialization, hospital_name,
            appointment_date, appointment_time, appointment_type,
            reason_for_visit, status, consultation_fee
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending',%s)
        RETURNING *
        """,
        (
            apt_id, str(user["id"]), str(doctor["id"]),
            user["full_name"], user["email"], user.get("phone") or "",
            doctor["full_name"], doctor["specialization"], doctor["hospital"],
            body.appointmentDate, body.appointmentTime,
            body.appointmentType or "in-person",
            body.reasonForVisit or "",
            doctor["consultation_fee"],
        ),
    )

    return {
        "success": True,
        "appointment": _map_apt(rows[0]),
        "message": "Appointment booked successfully",
    }


# ── PUT /appointments/{appointment_id} ────────────────────────────────────────

@router.put("/{appointment_id}")
def update_appointment(
    appointment_id: str,
    body: UpdateAppointmentBody,
    user: dict = Depends(require_auth),
):
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can update appointment status")

    rows = query(
        """
        UPDATE appointments
        SET status = COALESCE(%s, status),
            notes  = COALESCE(%s, notes)
        WHERE id = %s AND doctor_id = %s
        RETURNING *
        """,
        (body.status, body.notes, appointment_id, str(user["id"])),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return {
        "success": True,
        "appointment": _map_apt(rows[0]),
        "message": "Appointment updated successfully",
    }


# ── DELETE /appointments/{appointment_id} ─────────────────────────────────────

@router.delete("/{appointment_id}")
def cancel_appointment(appointment_id: str, user: dict = Depends(require_auth)):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can cancel appointments")

    rows = query(
        """
        UPDATE appointments
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = 'patient',
            updated_at = NOW()
        WHERE id = %s AND patient_id = %s
        RETURNING *
        """,
        (appointment_id, str(user["id"])),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return {"success": True, "message": "Appointment cancelled successfully"}
