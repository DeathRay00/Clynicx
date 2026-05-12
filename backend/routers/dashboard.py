"""
routers/dashboard.py — Patient dashboard & sub-routes for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/routes/dashboard.js.

Endpoints (all prefixed /patient):
    GET /patient/dashboard
    GET /patient/appointments
    GET /patient/prescriptions
    GET /patient/reports
"""
import json
from datetime import date, datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from db import query
from middleware.auth import require_auth

router = APIRouter(prefix="/patient", tags=["patient"])


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
        "specialization": row.get("doctor_specialization"),
        "hospitalName": row.get("hospital_name"),
        "doctorSpecialization": row.get("doctor_specialization"),
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
    return {
        "id": str(row["id"]),
        "patientId": str(row["patient_id"]),
        "doctorId": str(row["doctor_id"]) if row.get("doctor_id") else None,
        "patientName": row.get("patient_name"),
        "reportType": row.get("report_type"),
        "labName": row.get("lab_name"),
        "cost": row.get("cost"),
        "aiAnalysis": ai_analysis,
        "uploadDate": str(row["upload_date"]) if row.get("upload_date") else None,
    }


# ── GET /patient/dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
def patient_dashboard(user: dict = Depends(require_auth)):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Unauthorized")

    today = date.today().isoformat()
    three_months_ago = (date.today() - timedelta(days=90)).isoformat()

    apts = query(
        "SELECT * FROM appointments WHERE patient_id = %s ORDER BY appointment_date",
        (user["id"],),
    )
    prescs = query(
        "SELECT * FROM prescriptions WHERE patient_id = %s ORDER BY prescribed_date DESC",
        (user["id"],),
    )
    reports = query(
        "SELECT * FROM medical_reports WHERE patient_id = %s ORDER BY upload_date DESC",
        (user["id"],),
    )

    upcoming_appointments = [
        _map_apt(a) for a in apts if _fmt_date(a.get("appointment_date")) and _fmt_date(a["appointment_date"]) >= today
    ][:3]

    recent_prescriptions = [_map_presc(p) for p in prescs[:3]]
    recent_reports = [_map_report(r) for r in reports[:1]]

    total_appointments = len(apts)
    completed_appointments = sum(1 for a in apts if a.get("status") == "completed")
    active_prescriptions = sum(1 for p in prescs if p.get("status") == "active")
    total_reports = len(reports)

    recent_apts_count = sum(
        1 for a in apts if _fmt_date(a.get("appointment_date")) and _fmt_date(a["appointment_date"]) >= three_months_ago
    )
    recent_reports_count = sum(
        1 for r in reports if r.get("upload_date") and str(r["upload_date"])[:10] >= three_months_ago
    )

    health_score = 70
    if recent_apts_count > 0:
        health_score += 10
    if recent_reports_count > 0:
        health_score += 10
    if active_prescriptions == 0:
        health_score += 5
    if upcoming_appointments:
        health_score += 5
    health_score = min(health_score, 100)

    return {
        "upcomingAppointments": upcoming_appointments,
        "recentPrescriptions": recent_prescriptions,
        "recentReports": recent_reports,
        "totalAppointments": total_appointments,
        "completedAppointments": completed_appointments,
        "upcomingAppointmentsCount": len(upcoming_appointments),
        "activePrescriptions": active_prescriptions,
        "totalPrescriptions": len(prescs),
        "totalReports": total_reports,
        "healthScore": health_score,
        "recentActivity": {
            "appointmentsLast3Months": recent_apts_count,
            "reportsLast3Months": recent_reports_count,
        },
    }


# ── GET /patient/appointments ─────────────────────────────────────────────────

@router.get("/appointments")
def patient_appointments(user: dict = Depends(require_auth)):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Unauthorized")
    today = date.today().isoformat()
    rows = query(
        "SELECT * FROM appointments WHERE patient_id = %s ORDER BY appointment_date DESC",
        (user["id"],),
    )
    appointments = [_map_apt(r) for r in rows]
    return {
        "appointments": appointments,
        "totalCount": len(appointments),
        "upcomingCount": sum(1 for a in appointments if a["appointmentDate"] and a["appointmentDate"] >= today),
    }


# ── GET /patient/prescriptions ────────────────────────────────────────────────

@router.get("/prescriptions")
def patient_prescriptions(user: dict = Depends(require_auth)):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Unauthorized")
    rows = query(
        "SELECT * FROM prescriptions WHERE patient_id = %s ORDER BY prescribed_date DESC",
        (user["id"],),
    )
    prescriptions = [_map_presc(r) for r in rows]
    return {"prescriptions": prescriptions, "totalCount": len(prescriptions)}


# ── GET /patient/reports ──────────────────────────────────────────────────────

@router.get("/reports")
def patient_reports(user: dict = Depends(require_auth)):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Unauthorized")
    rows = query(
        "SELECT * FROM medical_reports WHERE patient_id = %s ORDER BY upload_date DESC",
        (user["id"],),
    )
    reports = [_map_report(r) for r in rows]
    return {"reports": reports, "totalCount": len(reports)}
