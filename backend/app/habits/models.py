import uuid
from datetime import date, datetime, time
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    and_,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, string_enum
from app.core.life_areas import LifeArea
from app.goals.models import Goal


class Cadence(StrEnum):
    DAILY = "daily"  # on chosen weekdays
    WEEKLY = "weekly"  # a number of times per week, any day


class Measure(StrEnum):
    CHECK = "check"  # done or not
    AMOUNT = "amount"  # a number in `unit`, optionally against a target
    SPAN = "span"  # a start and end time, e.g. bedtime and wake time; amount is hours


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    area: Mapped[LifeArea | None] = mapped_column(string_enum(LifeArea, "habit_area"))
    cadence: Mapped[Cadence] = mapped_column(string_enum(Cadence, "habit_cadence"))
    # Monday = 0 … Sunday = 6; only for daily habits.
    weekdays: Mapped[list[int] | None] = mapped_column(ARRAY(SmallInteger))
    times_per_week: Mapped[int | None] = mapped_column(SmallInteger)
    measure: Mapped[Measure] = mapped_column(string_enum(Measure, "habit_measure"))
    unit: Mapped[str | None] = mapped_column(String(16))
    target_amount: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    protected: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    goal: Mapped[Goal | None] = relationship(
        primaryjoin=lambda: and_(Habit.goal_id == Goal.id, Goal.deleted_at.is_(None)),
        viewonly=True,
        lazy="joined",
    )


class HabitLog(Base):
    """One day's entry for a habit. Missed days are derived from the schedule, not stored."""

    __tablename__ = "habit_logs"
    __table_args__ = (UniqueConstraint("habit_id", "on_date"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    habit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"))
    on_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
