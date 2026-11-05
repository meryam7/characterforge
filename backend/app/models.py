from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(40))
    password_hash: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)  # str(User.id)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    style: Mapped[str] = mapped_column(String(60), default="anime")
    seed: Mapped[int] = mapped_column(Integer)  # identity seed shared by every generation
    reference_path: Mapped[str | None] = mapped_column(String(300), nullable=True)
    embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)  # identity vector (CLIP or mock histogram)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    designs: Mapped[list["Design"]] = relationship(
        back_populates="character", cascade="all, delete-orphan", order_by="Design.id"
    )


class Design(Base):
    __tablename__ = "designs"

    id: Mapped[int] = mapped_column(primary_key=True)
    character_id: Mapped[int] = mapped_column(ForeignKey("characters.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    kind: Mapped[str] = mapped_column(String(20), default="generate")  # generate | edit
    prompt: Mapped[str] = mapped_column(Text, default="")
    image_path: Mapped[str] = mapped_column(String(300))
    consistency: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    character: Mapped[Character] = relationship(back_populates="designs")


class Activity(Base):
    """Per-user history. No FK to characters on purpose: entries survive deleting the character,
    and the thumbnail is a separate copy (history/...) for the same reason."""

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(20))  # see services/history.ACTIONS
    character_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    character_name: Mapped[str] = mapped_column(String(120), default="")
    design_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[str] = mapped_column(Text, default="")
    thumb_path: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
