import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    and_,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, string_enum
from app.core.life_areas import LifeArea
from app.goals.models import Goal
from app.projects.models import Project


class TaskStatus(StrEnum):
    OPEN = "open"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_open_due", "due_date", postgresql_where=text("deleted_at IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    area: Mapped[LifeArea | None] = mapped_column(string_enum(LifeArea, "task_area"))
    status: Mapped[TaskStatus] = mapped_column(
        string_enum(TaskStatus, "task_status"), default=TaskStatus.OPEN
    )
    priority: Mapped[TaskPriority] = mapped_column(
        string_enum(TaskPriority, "task_priority"), default=TaskPriority.NORMAL
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    planned_minutes: Mapped[int | None] = mapped_column(SmallInteger)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped[Project | None] = relationship(lazy="joined")
    goal: Mapped[Goal | None] = relationship(
        primaryjoin=lambda: and_(Task.goal_id == Goal.id, Goal.deleted_at.is_(None)),
        viewonly=True,
        lazy="joined",
    )


class NextActionOverride(Base):
    """The owner picked a different task than the one Ethos highlighted."""

    __tablename__ = "next_action_overrides"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    suggested_task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE")
    )
    chosen_task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
