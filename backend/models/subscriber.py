from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import JSON, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from ..database import Base

# Align with `frontend/src/app/admin/subscribers/page.tsx` / public subscribe wizard.
VALID_INDUSTRIES = frozenset(
    [
        "Technology",
        "Healthcare",
        "Finance & Banking",
        "Manufacturing",
        "Education",
        "Retail & E-Commerce",
        "Government & Public Sector",
        "Media & Entertainment",
        "Energy & Utilities",
        "Other",
    ]
)


class Subscriber(Base):
    __tablename__ = "subscribers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    industries: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    domains: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    role_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Subscriber id={self.id} email={self.email!r}>"


def validate_industries_and_role_ids(
    db: Session,
    industries: list[str] | None,
    role_ids: list[int] | None,
) -> tuple[list[str] | None, list[int] | None]:
    """Normalize lists; ensure industries are allowed labels and role IDs exist."""
    from .role import Role

    out_ind: list[str] | None = None
    if industries is not None:
        cleaned = [str(x).strip() for x in industries if x is not None and str(x).strip()]
        for x in cleaned:
            if x not in VALID_INDUSTRIES:
                raise HTTPException(status_code=422, detail=f"Invalid industry: {x}")
        out_ind = cleaned or None

    out_roles: list[int] | None = None
    if role_ids is not None:
        uniq: list[int] = []
        for x in role_ids:
            uniq.append(int(x))
        uniq = list(dict.fromkeys(uniq))
        if uniq:
            n = db.query(Role).filter(Role.id.in_(uniq)).count()
            if n != len(uniq):
                raise HTTPException(status_code=422, detail="Invalid role_ids")
        out_roles = uniq or None

    return out_ind, out_roles
