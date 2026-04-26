import secrets
from datetime import UTC, datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


def _issue_token() -> str:
    return secrets.token_urlsafe(32)


class NewsletterIssue(Base):
    __tablename__ = "newsletter_issues"

    token: Mapped[str] = mapped_column(String(96), primary_key=True, default=_issue_token)
    subscriber_email: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(512), nullable=False)
    html: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
