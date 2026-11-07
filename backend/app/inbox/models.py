import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, string_enum


class Outcome(StrEnum):
    TASK = "task"
    PROJECT = "project"
    GOAL = "goal"
    DONE = "done"  # handled without creating anything
    DISMISSED = "dismissed"


class InboxItem(Base):
    """A raw capture. Processing records what happened to it; nothing is ever silently dropped."""

    __tablename__ = "inbox_items"
    __table_args__ = (
        Index("ix_inbox_items_open", "created_at", postgresql_where=text("processed_at IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(16), server_default="web")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    outcome: Mapped[Outcome | None] = mapped_column(string_enum(Outcome, "inbox_outcome"))
    # The record the item became. Not a foreign key: it may point at a task, project or goal.
    result_id: Mapped[uuid.UUID | None]
