import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.calendar import habit_sessions
from app.calendar.service import Context
from app.core.clock import local_today
from app.core.db import get_session
from app.goals.service import GoalUnavailableError
from app.habits import service
from app.habits.models import Habit, HabitLog
from app.habits.schemas import DayRead, HabitCreate, HabitRead, HabitUpdate, HabitView, LogWrite
from app.preferences.deps import TimezoneDep
from app.preferences.service import get_preferences

router = APIRouter(prefix="/habits", tags=["habits"])

SessionDep = Annotated[Session, Depends(get_session)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Habit not found"}}


def _load(session: Session, habit_id: uuid.UUID, *, trashed: bool = False) -> Habit:
    try:
        return service.get_habit(session, habit_id, trashed=trashed)
    except service.HabitNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Habit not found") from None


def _read(habit: Habit, logs: dict[date, HabitLog], timezone: str) -> HabitRead:
    today = local_today(datetime.now(UTC), timezone)
    start = service.started_on(habit, logs, timezone)
    fields = {name: getattr(habit, name) for name in HabitRead.model_fields if name != "summary"}
    return HabitRead(**fields, summary=service.summarize(habit, logs, today, start))


def _read_one(session: Session, habit: Habit, timezone: str) -> HabitRead:
    return _read(habit, service.logs_by_habit(session, [habit.id])[habit.id], timezone)


def _goal_not_found() -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Goal not found")


def _booking(habit: Habit) -> tuple[object, ...]:
    """The fields that decide when a habit's sessions are booked."""
    return (
        habit.session_minutes,
        habit.session_time,
        habit.cadence,
        habit.weekdays,
        habit.times_per_week,
        habit.protected,
    )


def _rebook(session: Session, habit: Habit) -> None:
    now = datetime.now(UTC)
    habit_sessions.release_future(session, now, habit.id)
    context = Context.of(get_preferences(session), now)
    habit_sessions.refresh(session, context, context.today + timedelta(days=1))


@router.get("")
def list_habits(
    session: SessionDep,
    timezone: TimezoneDep,
    view: Annotated[HabitView, Query()] = "active",
    goal_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[HabitRead]:
    habits = service.list_habits(session, view, goal_id)
    logs = service.logs_by_habit(session, (habit.id for habit in habits))
    return [_read(habit, logs[habit.id], timezone) for habit in habits]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_habit(data: HabitCreate, session: SessionDep, timezone: TimezoneDep) -> HabitRead:
    try:
        habit = service.create_habit(session, data)
    except GoalUnavailableError:
        raise _goal_not_found() from None
    if habit.session_minutes is not None:
        _rebook(session, habit)
    return _read(habit, {}, timezone)


@router.get("/{habit_id}", responses=NOT_FOUND)
def get_habit(habit_id: uuid.UUID, session: SessionDep, timezone: TimezoneDep) -> HabitRead:
    return _read_one(session, _load(session, habit_id), timezone)


@router.patch("/{habit_id}", responses=NOT_FOUND)
def update_habit(
    habit_id: uuid.UUID, changes: HabitUpdate, session: SessionDep, timezone: TimezoneDep
) -> HabitRead:
    habit = _load(session, habit_id)
    booking = _booking(habit)
    try:
        service.update_habit(session, habit, changes)
    except ValidationError as error:
        raise RequestValidationError(
            error.errors(include_url=False, include_context=False)
        ) from None
    except GoalUnavailableError:
        raise _goal_not_found() from None
    if _booking(habit) != booking:
        _rebook(session, habit)
    return _read_one(session, habit, timezone)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def trash_habit(habit_id: uuid.UUID, session: SessionDep) -> None:
    now = datetime.now(UTC)
    service.trash_habit(session, _load(session, habit_id), now)
    habit_sessions.release_future(session, now, habit_id)


@router.post("/{habit_id}/restore", responses=NOT_FOUND)
def restore_habit(habit_id: uuid.UUID, session: SessionDep, timezone: TimezoneDep) -> HabitRead:
    habit = service.restore_habit(session, _load(session, habit_id, trashed=True))
    return _read_one(session, habit, timezone)


@router.put("/{habit_id}/logs/{on_date}", responses=NOT_FOUND)
def write_log(
    habit_id: uuid.UUID,
    on_date: date,
    data: LogWrite,
    session: SessionDep,
    timezone: TimezoneDep,
) -> HabitRead:
    """Creates or replaces that day's entry and returns the habit's fresh summary."""
    habit = _load(session, habit_id)
    today = local_today(datetime.now(UTC), timezone)
    try:
        service.write_log(session, habit, on_date, data, today)
    except service.InvalidLogError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, error.message) from None
    return _read_one(session, habit, timezone)


@router.delete("/{habit_id}/logs/{on_date}", responses=NOT_FOUND)
def delete_log(
    habit_id: uuid.UUID, on_date: date, session: SessionDep, timezone: TimezoneDep
) -> HabitRead:
    habit = _load(session, habit_id)
    service.delete_log(session, habit, on_date)
    return _read_one(session, habit, timezone)


@router.get("/{habit_id}/history", responses=NOT_FOUND)
def habit_history(
    habit_id: uuid.UUID,
    session: SessionDep,
    timezone: TimezoneDep,
    weeks: Annotated[int, Query(ge=1, le=53)] = 12,
) -> list[DayRead]:
    habit = _load(session, habit_id)
    logs = service.logs_by_habit(session, [habit.id])[habit.id]
    today = local_today(datetime.now(UTC), timezone)
    start = service.started_on(habit, logs, timezone)
    return service.history(habit, logs, today, start, weeks)
