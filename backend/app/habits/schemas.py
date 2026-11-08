import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.core.fields import Description, Title
from app.core.life_areas import LifeArea
from app.goals.schemas import GoalRef
from app.habits.models import Cadence, Measure
from app.habits.rules import DayState

HabitView = Literal["active", "trash"]
Weekday = Annotated[int, Field(ge=0, le=6)]
Unit = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=16)]
Amount = Annotated[Decimal, Field(gt=0, max_digits=8, decimal_places=2)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
SessionMinutes = Annotated[int, Field(ge=5, le=480)]

SPAN_UNIT = "h"


class HabitCreate(BaseModel):
    title: Title
    description: Description | None = None
    area: LifeArea | None = None
    cadence: Cadence
    weekdays: list[Weekday] | None = None
    times_per_week: Annotated[int, Field(ge=1, le=7)] | None = None
    measure: Measure = Measure.CHECK
    unit: Unit | None = None
    target_amount: Amount | None = None
    protected: bool = False
    goal_id: uuid.UUID | None = None
    session_minutes: SessionMinutes | None = None
    session_time: time | None = None

    @model_validator(mode="after")
    def consistent_schedule_and_measure(self) -> Self:
        if self.cadence is Cadence.DAILY:
            if not self.weekdays:
                raise ValueError("a daily habit needs at least one weekday")
            self.weekdays = sorted(set(self.weekdays))
            self.times_per_week = None
        else:
            if self.times_per_week is None:
                raise ValueError("a weekly habit needs times_per_week")
            self.weekdays = None

        if self.measure is Measure.CHECK:
            self.unit, self.target_amount = None, None
        elif self.measure is Measure.SPAN:
            self.unit = SPAN_UNIT
        elif self.unit is None:
            raise ValueError("an amount habit needs a unit")

        if self.session_minutes is None:
            self.session_time = None
        elif self.session_time is not None:
            self.session_time = self.session_time.replace(second=0, microsecond=0, tzinfo=None)
        return self


class HabitUpdate(BaseModel):
    """Partial update. The merged habit is re-validated as a whole by the service."""

    title: Title | None = None
    description: Description | None = None
    area: LifeArea | None = None
    cadence: Cadence | None = None
    weekdays: list[Weekday] | None = None
    times_per_week: Annotated[int, Field(ge=1, le=7)] | None = None
    measure: Measure | None = None
    unit: Unit | None = None
    target_amount: Amount | None = None
    protected: bool | None = None
    goal_id: uuid.UUID | None = None
    session_minutes: SessionMinutes | None = None
    session_time: time | None = None


class LogWrite(BaseModel):
    amount: Amount | None = None
    start_time: time | None = None
    end_time: time | None = None
    note: Note | None = None


class LogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    on_date: date
    amount: Decimal | None
    start_time: time | None
    end_time: time | None
    note: str | None


class DayRead(BaseModel):
    date: date
    state: DayState
    amount: Decimal | None = None


class HabitSummary(BaseModel):
    today: DayRead
    today_log: LogRead | None
    streak: int
    streak_unit: Literal["days", "weeks"]
    week_done: int
    week_target: int
    recent: list[DayRead]


class HabitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    area: LifeArea | None
    cadence: Cadence
    weekdays: list[int] | None
    times_per_week: int | None
    measure: Measure
    unit: str | None
    target_amount: Decimal | None
    protected: bool
    goal_id: uuid.UUID | None
    goal: GoalRef | None
    session_minutes: int | None
    session_time: time | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    summary: HabitSummary
