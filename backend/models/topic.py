import enum

from sqlalchemy import JSON, Boolean, Enum, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class TopicStatus(str, enum.Enum):
    pending = "pending"
    watched = "watched"
    selected = "selected"


class AdoptionState(str, enum.Enum):
    learn_about = "Learn About"
    get_ahead_of = "Get Ahead Of"
    get_prepared_for = "Get Prepared For"
    get_your_hands_around = "Get Your Hands Around"
    make_the_most_of = "Make the Most Of"


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (
        UniqueConstraint("domain", "subdomain", "name", name="uq_topics_domain_subdomain_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    domain: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., AI, Security, Cloud
    # Theme within domain (from classify + clustering); links articles only when domain+subdomain+name match
    subdomain: Mapped[str] = mapped_column(
        String(120), default="", server_default="", nullable=False
    )
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    urgency_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[TopicStatus] = mapped_column(
        Enum(TopicStatus), default=TopicStatus.pending, nullable=False, index=True
    )
    adoption_state: Mapped[AdoptionState] = mapped_column(
        Enum(AdoptionState), default=AdoptionState.learn_about, nullable=False
    )
    # Maps industry name → {urgency_score, adoption_state, rationale} for per-industry radar points
    industry_positions: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    # Optional topic-level persona lines per Role.name; when set, Analysis Persona tab prefers this over
    # aggregating article.persona_impacts.
    persona_by_role: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    # True = visible on the public radar; False = selected but held in sandbox
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    # Daily newsletter deep-dive copy (optional). Keys: what_is_it, what_changed, why_it_matters, what_to_do
    newsletter_briefing: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)

    articles: Mapped[list["Article"]] = relationship("Article", back_populates="topic")

    @property
    def article_count(self) -> int:
        return sum(1 for a in self.articles if a.archived_at is None)

    def __repr__(self) -> str:
        return f"<Topic id={self.id} name={self.name!r} domain={self.domain!r} status={self.status!r} adoption_state={self.adoption_state!r}>"
