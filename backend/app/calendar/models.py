import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, string_enum


class BlockKind(StrEnum):
    TASK = "task"  # an Ethos work block for a task
    HABIT = "habit"  # an Ethos block for a recurring habit, e.g. the daily LeetCode session
    EVENT = "event"  # an external Google Calendar event; always fixed


class BlockStatus(StrEnum):
    SCHEDULED = "scheduled"
    DONE = "done"
    MISSED = "missed"


class SyncOp(StrEnum):
    """The change still owed to Google Calendar. Each block is its own outbox entry."""

    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class CalendarBlock(Base):
    __tablename__ = "calendar_blocks"
    __table_args__ = (CheckConstraint("starts_at < ends_at", name="ordered"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    kind: Mapped[BlockKind] = mapped_column(string_enum(BlockKind, "block_kind"))
    title: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    habit_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[BlockStatus] = mapped_column(
        string_enum(BlockStatus, "block_status"), default=BlockStatus.SCHEDULED
    )
    # Fixed blocks are never moved by Ethos: external events and protected habit sessions.
    fixed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # A same-day recovery block points at the session it replaces.
    recovers_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("calendar_blocks.id", ondelete="SET NULL")
    )
    external_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    sync_op: Mapped[SyncOp | None] = mapped_column(string_enum(SyncOp, "block_sync_op"))
    sync_error: Mapped[str | None] = mapped_column(Text)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
