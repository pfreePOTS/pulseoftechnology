from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from ..config import settings
from ..models.subscriber import Subscriber

_PREFERENCES_AUDIENCE = "subscriber_preferences"
_ALGORITHM = "HS256"


def create_subscriber_preferences_token(
    subscriber: Subscriber,
    *,
    expires_in_days: int = 365,
) -> str:
    """Create a tamper-proof magic-link token for subscriber preference management."""
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subscriber.id),
        "email": subscriber.email,
        "aud": _PREFERENCES_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(days=expires_in_days),
    }
    return jwt.encode(payload, settings.subscriber_token_secret, algorithm=_ALGORITHM)


def decode_subscriber_preferences_token(token: str) -> tuple[int, str]:
    """Return (subscriber_id, email) or raise PyJWTError for invalid/expired tokens."""
    payload = jwt.decode(
        token,
        settings.subscriber_token_secret,
        algorithms=[_ALGORITHM],
        audience=_PREFERENCES_AUDIENCE,
    )
    return int(payload["sub"]), str(payload["email"]).strip().lower()
