import uuid
from datetime import date

from pydantic import BaseModel

from app.analytics.rules import Period
from app.core.life_areas import LifeArea


class Totals(BaseModel):
    completed: int
    cancelled: int
    created: int
    deadlines_met: int
    # Only deadlines whose date has already passed can be missed.
    deadlines_missed: int
    habit_done: int
    habit_expected: int
    captured: int
    processed: int
    notes_edited: int


class DayCount(BaseModel):
    date: date
    count: int


class AreaCount(BaseModel):
    area: LifeArea | None
    count: int


class HabitAdherence(BaseModel):
    id: uuid.UUID
    title: str
    done: int
    # Scheduled days (or weekly targets) that have come due inside the window.
    expected: int


class AnalyticsReport(BaseModel):
    period: Period
    offset: int
    label: str
    start: date
    end: date
    is_current: bool
    totals: Totals
    previous: Totals
    completed_by_day: list[DayCount]
    completed_by_area: list[AreaCount]
    habits: list[HabitAdherence]
    inbox_median_hours: float | None
    overdue_now: int
    inbox_open: int
    observations: list[str]
