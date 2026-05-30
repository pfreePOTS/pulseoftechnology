import enum
from datetime import UTC, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class DomainStatus(str, enum.Enum):
    core = "core"
    active = "active"
    candidate = "candidate"
    deprecated = "deprecated"
    hidden = "hidden"


class Domain(Base):
    __tablename__ = "domains"
    __table_args__ = (
        CheckConstraint(
            "status IN ('core', 'active', 'candidate', 'deprecated', 'hidden')",
            name="ck_domains_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    short_label: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#6B7280")
    hero_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=DomainStatus.core.value)
    merged_into_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("domains.id", ondelete="SET NULL"), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    demoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    merged_into: Mapped["Domain | None"] = relationship(
        "Domain", remote_side="Domain.id", foreign_keys=[merged_into_id]
    )
    topics: Mapped[list["Topic"]] = relationship("Topic", back_populates="domain")

    def __repr__(self) -> str:
        return f"<Domain id={self.id} slug={self.slug!r} status={self.status!r}>"


class DomainHealthSnapshot(Base):
    __tablename__ = "domain_health_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    domain_id: Mapped[int] = mapped_column(Integer, ForeignKey("domains.id", ondelete="CASCADE"))
    as_of_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    active_topics: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fresh_articles_30d: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    subscribers_picked: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    signal_count_30d: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class DomainInterestSignal(Base):
    __tablename__ = "domain_interest_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    domain_id: Mapped[int] = mapped_column(Integer, ForeignKey("domains.id", ondelete="CASCADE"))
    subscriber_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("subscribers.id", ondelete="SET NULL"), nullable=True
    )
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    weight: Mapped[float] = mapped_column(default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class DomainSuggestion(Base):
    __tablename__ = "domain_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    subscriber_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("subscribers.id", ondelete="SET NULL"), nullable=True
    )
    matched_domain_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("domains.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
