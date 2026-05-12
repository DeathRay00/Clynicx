"""
routers/auth.py — Authentication routes for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/routes/auth.js.

Endpoints:
    POST /auth/signup
    POST /auth/login
    GET  /auth/profile
"""
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from typing import Optional, Any
import bcrypt
from jose import jwt
from db import query
from middleware.auth import require_auth

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_DAYS = 7


def _make_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "userId": user_id,
        "email": email,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ── Request Bodies ────────────────────────────────────────────────────────────

class SignupBody(BaseModel):
    email: str
    password: str
    fullName: str
    phone: Optional[str] = None
    role: str
    # Patient fields
    dateOfBirth: Optional[str] = None
    gender: Optional[str] = None
    bloodGroup: Optional[str] = None
    # Doctor fields
    medicalLicenseNumber: Optional[str] = None
    specialization: Optional[str] = None
    experience: Optional[str] = None
    consultationFee: Optional[Any] = 500
    hospital: Optional[str] = None
    qualifications: Optional[str] = None


class LoginBody(BaseModel):
    email: str
    password: str


# ── POST /auth/signup ─────────────────────────────────────────────────────────

@router.post("/signup", status_code=201)
def signup(body: SignupBody):
    if not body.email or not body.password or not body.fullName or not body.role:
        raise HTTPException(
            status_code=400,
            detail="email, password, fullName and role are required",
        )

    email = body.email.lower()

    # Check duplicate
    existing = query("SELECT id FROM users WHERE email = %s", (email,))
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Hash password
    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(12)).decode()

    # Clean experience to INT for years_of_experience
    exp_int = None
    if body.experience:
        try:
            exp_int = int(''.join(filter(str.isdigit, str(body.experience))))
        except ValueError:
            exp_int = None

    rows = query(
        """
        INSERT INTO users (
            email, password_hash, full_name, phone, role,
            date_of_birth, gender, blood_group,
            medical_license_number, specialization, years_of_experience,
            consultation_fee, hospital_name
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id, email, full_name, phone, role, specialization, created_at
        """,
        (
            email, password_hash, body.fullName, body.phone, body.role,
            body.dateOfBirth, body.gender, body.bloodGroup,
            body.medicalLicenseNumber, body.specialization, exp_int,
            body.consultationFee or 500, body.hospital,
        ),
    )

    user = rows[0]
    token = _make_token(str(user["id"]), user["email"], user["role"])

    return {
        "success": True,
        "userId": str(user["id"]),
        "token": token,
        "user": {
            "id": str(user["id"]),
            "email": user["email"],
            "fullName": user["full_name"],
            "phone": user["phone"],
            "role": user["role"],
        },
    }


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post("/login")
def login(body: LoginBody):
    if not body.email or not body.password:
        raise HTTPException(status_code=400, detail="email and password are required")

    rows = query("SELECT * FROM users WHERE email = %s", (body.email.lower(),))
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = rows[0]
    valid = bcrypt.checkpw(body.password.encode(), user["password_hash"].encode())
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _make_token(str(user["id"]), user["email"], user["role"])

    return {
        "success": True,
        "token": token,
        "user": {
            "id": str(user["id"]),
            "email": user["email"],
            "fullName": user["full_name"],
            "phone": user["phone"],
            "role": user["role"],
        },
    }


# ── GET /auth/profile ─────────────────────────────────────────────────────────

@router.get("/profile")
def profile(user: dict = Depends(require_auth)):
    u = user
    return {
        "id": str(u["id"]),
        "email": u["email"],
        "fullName": u["full_name"],
        "phone": u["phone"],
        "role": u["role"],
        "dateOfBirth": str(u["date_of_birth"]) if u["date_of_birth"] else None,
        "gender": u["gender"],
        "bloodGroup": u["blood_group"],
        "specialization": u["specialization"],
        "medicalLicenseNumber": u["medical_license_number"],
        "experience": u.get("years_of_experience"),
        "consultationFee": u.get("consultation_fee"),
        "hospital": u.get("hospital_name"),
        "bio": u.get("bio"),
        "createdAt": str(u["created_at"]) if u.get("created_at") else None,
    }
