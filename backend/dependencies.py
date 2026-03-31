import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

_bearer = HTTPBearer(auto_error=False)

# httpOnly cookie name for browser admin sessions
ADMIN_COOKIE_NAME = "pulse_admin"


def verify_admin_password(plain: str) -> bool:
    """
    Verify admin login password. Prefer ADMIN_PASSWORD_HASH (bcrypt) in production;
    fall back to timing-safe comparison against ADMIN_PASSWORD for local dev.
    """
    if settings.admin_password_hash:
        try:
            return bcrypt.checkpw(
                plain.encode("utf-8"),
                settings.admin_password_hash.encode("utf-8"),
            )
        except (ValueError, TypeError):
            return False
    return secrets.compare_digest(
        plain.encode("utf-8"),
        settings.admin_password.encode("utf-8"),
    )


def create_admin_access_token() -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.admin_token_expire_minutes)
    payload = {"sub": "admin", "exp": expire}
    return jwt.encode(payload, settings.admin_jwt_secret, algorithm="HS256")


def decode_admin_token(token: str) -> dict:
    return jwt.decode(token, settings.admin_jwt_secret, algorithms=["HS256"])


def get_token_from_request(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials and credentials.credentials:
        return credentials.credentials
    return request.cookies.get(ADMIN_COOKIE_NAME)


def require_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> None:
    """Validate JWT from Authorization: Bearer or httpOnly cookie."""
    token = get_token_from_request(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        decode_admin_token(token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
