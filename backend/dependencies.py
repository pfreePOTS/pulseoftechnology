import logging
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import inspect
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from .admin_permissions import normalize_login_email, user_may_access_admin_path
from .config import settings
from .database import get_db
from .models.admin_user import AdminUser

_bearer = HTTPBearer(auto_error=False)

# httpOnly cookie name for browser admin sessions
ADMIN_COOKIE_NAME = "pulse_admin"


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode()


def verify_admin_password(plain: str) -> bool:
    """
    Verify password against ADMIN_PASSWORD_HASH or ADMIN_PASSWORD (env only).
    Console login uses AdminUser rows and verify_password(); this remains for
    scripts, tests, and backward-compatible imports during hot reload.
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


def create_admin_access_token(user: AdminUser) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.admin_token_expire_minutes)
    payload = {
        "sub": str(user.id),
        "exp": expire,
    }
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


def get_admin_user_from_token(token: str, db: Session) -> AdminUser:
    try:
        payload = decode_admin_token(token)
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.get(AdminUser, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
    db: Session = Depends(get_db),
) -> AdminUser:
    """Validate JWT and enforce page permissions for the request path."""
    token = get_token_from_request(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_admin_user_from_token(token, db)
    path = request.url.path
    perms = user.page_permissions if isinstance(user.page_permissions, list) else []
    if not user_may_access_admin_path(path, user.is_superuser, perms):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return user


def require_superuser(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
    db: Session = Depends(get_db),
) -> AdminUser:
    token = get_token_from_request(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_admin_user_from_token(token, db)
    if not user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return user


def bootstrap_first_admin_if_empty() -> None:
    """Create the first superuser from env when the admin_users table is empty."""
    from .database import SessionLocal

    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        bind = db.get_bind()
        if bind is not None and not inspect(bind).has_table("admin_users"):
            logger.warning(
                "admin_users table missing — apply DB migrations first: "
                "docker compose exec -w /app/backend backend alembic upgrade head"
            )
            return

        if db.query(AdminUser).count() > 0:
            return
        email = normalize_login_email(settings.first_admin_email)
        pw = settings.admin_password
        if not pw and settings.admin_password_hash:
            # Production may set only hash — cannot bootstrap without a plain password
            return
        if not pw:
            return
        db.add(
            AdminUser(
                email=email,
                password_hash=hash_password(pw),
                is_superuser=True,
                is_active=True,
                must_change_password=False,
                page_permissions=[],
            )
        )
        db.commit()
    except ProgrammingError as exc:
        msg = str(exc).lower()
        if "admin_users" in msg or "undefinedtable" in msg:
            logger.warning(
                "admin_users not available yet; run: "
                "docker compose exec -w /app/backend backend alembic upgrade head (%s)",
                exc,
            )
            return
        raise
    finally:
        db.close()
