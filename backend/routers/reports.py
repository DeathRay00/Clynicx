"""
routers/reports.py — Medical report CRUD routes for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/routes/reports.js.

Endpoints:
    GET    /reports
    GET    /reports/{report_id}
    POST   /reports
    DELETE /reports/{report_id}
    PUT    /reports/{report_id}
"""
import uuid
import json
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db import query
from middleware.auth import require_auth

router = APIRouter(prefix="/reports", tags=["reports"])


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
        "doctorName": row.get("doctor_name"),
        "reportType": row.get("report_type"),
        "labName": row.get("lab_name"),
        "cost": row.get("cost"),
        "fileUrl": row.get("file_url"),
        "aiAnalysis": ai_analysis,
        "uploadDate": str(row["upload_date"]) if row.get("upload_date") else None,
        "createdAt": str(row["created_at"]) if row.get("created_at") else None,
    }


# ── Request Bodies ────────────────────────────────────────────────────────────

class UploadReportBody(BaseModel):
    doctorId: Optional[str] = None
    reportType: Optional[str] = None
    labName: Optional[str] = None
    cost: Optional[str] = None
    fileUrl: Optional[str] = None
    aiAnalysis: Optional[Any] = None


class UpdateReportBody(BaseModel):
    aiAnalysis: Any


# ── GET /reports ──────────────────────────────────────────────────────────────

@router.get("")
def list_reports(user: dict = Depends(require_auth)):
    if user["role"] == "patient":
        rows = query(
            "SELECT * FROM medical_reports WHERE patient_id = %s ORDER BY upload_date DESC",
            (user["id"],),
        )
    elif user["role"] == "doctor":
        rows = query(
            "SELECT * FROM medical_reports WHERE doctor_id = %s ORDER BY upload_date DESC",
            (user["id"],),
        )
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    reports = [_map_report(r) for r in rows]
    return {
        "reports": reports,
        "totalCount": len(reports),
        "analyzedCount": sum(1 for r in reports if r["aiAnalysis"]),
        "pendingCount": sum(1 for r in reports if not r["aiAnalysis"]),
    }


# ── GET /reports/{report_id} ──────────────────────────────────────────────────

@router.get("/{report_id}")
def get_report(report_id: str, user: dict = Depends(require_auth)):
    rows = query("SELECT * FROM medical_reports WHERE id = %s", (report_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Report not found")

    r = rows[0]
    if str(r["patient_id"]) != str(user["id"]) and (
        r.get("doctor_id") is None or str(r["doctor_id"]) != str(user["id"])
    ):
        raise HTTPException(status_code=403, detail="Unauthorized")

    return _map_report(r)


# ── POST /reports ─────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def upload_report(body: UploadReportBody, user: dict = Depends(require_auth)):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can upload reports")

    # Get doctor name if provided
    doctor_name = None
    if body.doctorId:
        docs = query("SELECT full_name FROM users WHERE id = %s", (body.doctorId,))
        if docs:
            doctor_name = docs[0]["full_name"]

    report_id = str(uuid.uuid4())
    ai_json = json.dumps(body.aiAnalysis) if body.aiAnalysis is not None else None

    rows = query(
        """
        INSERT INTO medical_reports (
            id, patient_id, doctor_id, patient_name, doctor_name,
            report_type, lab_name, cost, file_url, ai_analysis
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING *
        """,
        (
            report_id,
            str(user["id"]),
            body.doctorId or None,
            user["full_name"],
            doctor_name,
            body.reportType,
            body.labName,
            body.cost,
            body.fileUrl,
            ai_json,
        ),
    )

    # Log activity for doctor if provided
    if body.doctorId:
        query(
            """
            INSERT INTO doctor_activity (id, doctor_id, patient_id, patient_name, activity_type, report_type)
            VALUES (%s,%s,%s,%s,'report_upload',%s)
            """,
            (str(uuid.uuid4()), body.doctorId, str(user["id"]), user["full_name"], body.reportType),
        )

    return {"success": True, "report": _map_report(rows[0])}


# ── DELETE /reports/{report_id} ───────────────────────────────────────────────

@router.delete("/{report_id}")
def delete_report(report_id: str, user: dict = Depends(require_auth)):
    check = query(
        "SELECT id FROM medical_reports WHERE id = %s AND patient_id = %s",
        (report_id, str(user["id"])),
    )
    if not check:
        raise HTTPException(status_code=404, detail="Report not found or unauthorized")

    query("DELETE FROM medical_reports WHERE id = %s", (report_id,))
    return {"success": True}


# ── PUT /reports/{report_id} ──────────────────────────────────────────────────

@router.put("/{report_id}")
def update_report(report_id: str, body: UpdateReportBody, user: dict = Depends(require_auth)):
    ai_json = json.dumps(body.aiAnalysis)
    rows = query(
        """
        UPDATE medical_reports
        SET ai_analysis = %s
        WHERE id = %s AND patient_id = %s
        RETURNING *
        """,
        (ai_json, report_id, str(user["id"])),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Report not found")

    return {"success": True, "report": _map_report(rows[0])}
