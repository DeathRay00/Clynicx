"""
routers/patients.py — Doctor-facing routes for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/routes/patients.js.

Endpoints (all prefixed /doctor):
    GET  /doctor/dashboard
    GET  /doctor/appointments
    GET  /doctor/patients
    GET  /doctor/patients/{patient_id}
    POST /doctor/patients/{patient_id}/prescriptions
"""
import uuid
import json
from datetime import date, datetime, timedelta
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db import query
from middleware.auth import require_auth

router = APIRouter(prefix="/doctor", tags=["doctor"])


# ── Mappers ───────────────────────────────────────────────────────────────────

def _fmt_date(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, (date, datetime)):
        return val.isoformat()[:10]
    return str(val)[:10]


def _map_apt(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "patientId": str(row["patient_id"]),
        "doctorId": str(row["doctor_id"]),
        "patientName": row.get("patient_name"),
        "patientEmail": row.get("patient_email"),
        "patientPhone": row.get("patient_phone"),
        "doctorName": row.get("doctor_name"),
        "doctorSpecialization": row.get("doctor_specialization"),
        "hospitalName": row.get("hospital_name"),
        "appointmentDate": _fmt_date(row.get("appointment_date")),
        "appointmentTime": row.get("appointment_time"),
        "appointmentType": row.get("appointment_type"),
        "reasonForVisit": row.get("reason_for_visit"),
        "status": row.get("status"),
        "consultationFee": row.get("consultation_fee"),
        "notes": row.get("notes"),
        "bookedAt": str(row["booked_at"]) if row.get("booked_at") else None,
    }


def _map_presc(row: dict) -> dict:
    medicines = row.get("medicines") or []
    lab_tests = row.get("lab_tests") or []
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
        "followUpDate": _fmt_date(row.get("follow_up_date")),
        "consultationFee": row.get("consultation_fee"),
        "status": row.get("status"),
        "prescribedDate": str(row["prescribed_date"]) if row.get("prescribed_date") else None,
    }


def _map_report(row: dict) -> dict:
    ai_analysis = row.get("ai_analysis")
    if isinstance(ai_analysis, str):
        try:
            ai_analysis = json.loads(ai_analysis)
        except Exception:
            pass
    upload_date = _fmt_date(row.get("upload_date") or row.get("created_at"))
    return {
        "id": str(row["id"]),
        "patientId": str(row["patient_id"]),
        "patientName": row.get("patient_name"),
        "doctorId": str(row["doctor_id"]) if row.get("doctor_id") else None,
        "doctorName": row.get("doctor_name"),
        "fileName": row.get("file_url") or "report.pdf",
        "fileSize": "-",
        "reportType": row.get("report_type") or "other",
        "dateUploaded": upload_date,
        "reportDate": upload_date,
        "status": "analyzed" if ai_analysis else "uploaded",
        "labName": row.get("lab_name"),
        "cost": row.get("cost"),
        "aiAnalysis": ai_analysis,
        "createdAt": str(row["created_at"]) if row.get("created_at") else None,
    }


# ── GET /doctor/dashboard ─────────────────────────────────────────────────────

@router.get("/dashboard")
def doctor_dashboard(user: dict = Depends(require_auth)):
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Unauthorized")

    today = date.today().isoformat()
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()
    this_week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()

    apts = query(
        "SELECT * FROM appointments WHERE doctor_id = %s ORDER BY appointment_date, appointment_time",
        (user["id"],),
    )
    prescs = query("SELECT id FROM prescriptions WHERE doctor_id = %s", (user["id"],))
    reports = query("SELECT id FROM medical_reports WHERE doctor_id = %s", (user["id"],))
    activity = query(
        "SELECT * FROM doctor_activity WHERE doctor_id = %s AND upload_date >= %s ORDER BY upload_date DESC",
        (user["id"], week_ago),
    )

    today_apts = [
        _map_apt(a) for a in apts if _fmt_date(a.get("appointment_date")) == today
    ]
    upcoming = [
        _map_apt(a) for a in apts
        if a.get("appointment_date") and today < _fmt_date(a["appointment_date"]) <= next_week
    ][:5]

    all_patient_ids = {str(a["patient_id"]) for a in apts}
    this_week_apts = [a for a in apts if _fmt_date(a.get("appointment_date")) and _fmt_date(a["appointment_date"]) >= this_week_start]

    return {
        "todayAppointments": today_apts,
        "recentActivity": activity,
        "upcomingAppointments": upcoming,
        "totalAppointments": len(today_apts),
        "completedToday": sum(1 for a in today_apts if a["status"] == "completed"),
        "pendingToday": sum(1 for a in today_apts if a["status"] == "pending"),
        "totalPatients": len(all_patient_ids),
        "totalAppointmentsAllTime": len(apts),
        "totalPrescriptions": len(prescs),
        "totalReports": len(reports),
        "thisWeekAppointments": len(this_week_apts),
        "thisWeekCompleted": sum(1 for a in this_week_apts if a.get("status") == "completed"),
    }


# ── GET /doctor/appointments ──────────────────────────────────────────────────

@router.get("/appointments")
def doctor_appointments(user: dict = Depends(require_auth)):
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Unauthorized")
    rows = query(
        "SELECT * FROM appointments WHERE doctor_id = %s ORDER BY appointment_date DESC",
        (user["id"],),
    )
    appointments = [_map_apt(r) for r in rows]
    return {"appointments": appointments, "totalCount": len(appointments)}


# ── GET /doctor/patients ──────────────────────────────────────────────────────

@router.get("/patients")
def doctor_patients(user: dict = Depends(require_auth)):
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Unauthorized - Doctor access only")

    rows = query(
        """
        SELECT DISTINCT u.id, u.full_name, u.email, u.phone,
               u.date_of_birth, u.gender, u.blood_group, u.created_at,
               MAX(a.appointment_date) AS last_visit,
               COUNT(a.id) AS total_appointments
        FROM users u
        JOIN appointments a ON a.patient_id = u.id
        WHERE a.doctor_id = %s AND u.role = 'patient'
        GROUP BY u.id
        ORDER BY last_visit DESC NULLS LAST
        """,
        (user["id"],),
    )

    patients = [
        {
            "id": str(r["id"]),
            "fullName": r["full_name"],
            "email": r["email"],
            "phone": r["phone"],
            "dateOfBirth": _fmt_date(r.get("date_of_birth")),
            "gender": r["gender"],
            "bloodGroup": r["blood_group"],
            "lastVisit": _fmt_date(r.get("last_visit")),
            "totalAppointments": int(r["total_appointments"]),
            "createdAt": str(r["created_at"]) if r.get("created_at") else None,
        }
        for r in rows
    ]
    return {"patients": patients}


# ── GET /doctor/patients/{patient_id} ────────────────────────────────────────

@router.get("/patients/{patient_id}")
def doctor_patient_detail(patient_id: str, user: dict = Depends(require_auth)):
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Unauthorized - Doctor access only")

    p_rows = query("SELECT * FROM users WHERE id = %s AND role = 'patient'", (patient_id,))
    if not p_rows:
        raise HTTPException(status_code=404, detail="Patient not found")

    apts = query(
        "SELECT * FROM appointments WHERE patient_id = %s AND doctor_id = %s ORDER BY appointment_date DESC",
        (patient_id, str(user["id"])),
    )
    prescs = query(
        "SELECT * FROM prescriptions WHERE patient_id = %s AND doctor_id = %s ORDER BY prescribed_date DESC",
        (patient_id, str(user["id"])),
    )
    reports = query(
        "SELECT * FROM medical_reports WHERE patient_id = %s ORDER BY upload_date DESC",
        (patient_id,),
    )

    p = p_rows[0]
    return {
        "patient": {
            "id": str(p["id"]),
            "fullName": p["full_name"],
            "email": p["email"],
            "phone": p["phone"],
            "dateOfBirth": _fmt_date(p.get("date_of_birth")),
            "gender": p["gender"],
            "bloodGroup": p["blood_group"],
            "createdAt": str(p["created_at"]) if p.get("created_at") else None,
        },
        "appointments": [_map_apt(r) for r in apts],
        "prescriptions": [_map_presc(r) for r in prescs],
        "reports": [_map_report(r) for r in reports],
        "stats": {
            "totalAppointments": len(apts),
            "totalPrescriptions": len(prescs),
            "totalReports": len(reports),
        },
    }


# ── POST /doctor/patients/{patient_id}/prescriptions ─────────────────────────

class AddPrescriptionBody(BaseModel):
    diagnosis: Optional[str] = None
    medicines: Optional[List[Any]] = []
    labTests: Optional[List[Any]] = []
    instructions: Optional[str] = None
    followUpDate: Optional[str] = None
    consultationFee: Optional[Any] = None


@router.post("/patients/{patient_id}/prescriptions", status_code=201)
def add_prescription_for_patient(
    patient_id: str,
    body: AddPrescriptionBody,
    user: dict = Depends(require_auth),
):
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Unauthorized - Doctor access only")

    p_rows = query("SELECT * FROM users WHERE id = %s AND role = 'patient'", (patient_id,))
    if not p_rows:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient = p_rows[0]

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
            patient_id,
            str(user["id"]),
            patient["full_name"],
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

    return {
        "success": True,
        "message": "Prescription added successfully",
        "prescription": _map_presc(rows[0]),
    }
