"""
middleware/auth.py — JWT authentication dependency for FastAPI.
Mirrors the behaviour of the original Node.js src/middleware/auth.js.

Usage in routes:
    from middleware.auth import require_auth
    @router.get("/protected")
    def protected(user=Depends(require_auth)):
        ...
"""
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from db import query

JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
JWT_ALGORITHM = "HS256"

_bearer = HTTPBearer()


def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    Validate the Bearer JWT token.
    Returns the full user row from the DB (as a dict) on success.
    Raises HTTP 401 on failure.
    """
    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or expired token",
        )

    user_id = payload.get("userId")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid token payload",
        )

    rows = query("SELECT * FROM users WHERE id = %s", (user_id,))
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: User not found",
        )

    return rows[0]
