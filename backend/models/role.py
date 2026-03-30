from sqlalchemy import Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    # List of domain/tag strings that define what content this role cares about.
    # e.g. ["AI", "Security", "Leadership"] for a CTO profile.
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    subscribers: Mapped[list["Subscriber"]] = relationship("Subscriber", back_populates="role")

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name!r}>"
