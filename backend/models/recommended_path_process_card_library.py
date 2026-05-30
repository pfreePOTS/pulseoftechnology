"""Photorealistic library banners for `/recommended-path` Our Process cards (industry × section)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, LargeBinary, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class RecommendedPathProcessCardLibrary(Base):
    """Pre-rendered Our Process banners keyed by canonical ``(industry_slug, section_slug)``.

    Replaces per-intake OpenAI image generation on the request path: 20 industries × 4 sections
    (Understand / Recommend / Implement / Manage) seeded once via
    ``backend/scripts/seed_process_card_library.py``.
    """

    __tablename__ = "recommended_path_process_card_library"
    __table_args__ = (
        UniqueConstraint(
            "industry_slug",
            "section_slug",
            name="uq_rp_process_card_library_industry_section",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    industry_slug: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    section_slug: Mapped[str] = mapped_column(String(40), nullable=False)
    industry_label: Mapped[str] = mapped_column(String(120), nullable=False)
    section_label: Mapped[str] = mapped_column(String(40), nullable=False)
    image_blob: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False, default="image/png")
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    model: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
