import uuid
from datetime import UTC, date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.clock import local_today
from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.goals.service import GoalUnavailableError
from app.habits import service
from app.habits.models import Habit, HabitLog
from app.habits.schemas import DayRead, HabitCreate, HabitRead, HabitUpdate, HabitView, LogWrite

router = APIRouter(prefix="/habits", tags=["habits"])

SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Habit not found"}}


def _load(session: Session, habit_id: uuid.UUID, *, trashed: bool = False) -> Habit:
    try:
        return service.get_habit(session, habit_id, trashed=trashed)
    except service.HabitNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Habit not found") from None


def _read(habit: Habit, logs: dict[date, HabitLog], settings: Settings) -> HabitRead:
    today = local_today(datetime.now(UTC), settings.default_timezone)
    start = service.started_on(habit, logs, settings.default_timezone)
    fields = {name: getattr(habit, name) for name in HabitRead.model_fields if name != "summary"}
    return HabitRead(**fields, summary=service.summarize(habit, logs, today, start))


def _read_one(session: Session, habit: Habit, settings: Settings) -> HabitRead:
    return _read(habit, service.logs_by_habit(session, [habit.id])[habit.id], settings)


def _goal_not_found() -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Goal not found")


@router.get("")
def list_habits(
    session: SessionDep,
    settings: SettingsDep,
    view: Annotated[HabitView, Query()] = "active",
    goal_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[HabitRead]:
    habits = service.list_habits(session, view, goal_id)
    logs = service.logs_by_habit(session, (habit.id for habit in habits))
    return [_read(habit, logs[habit.id], settings) for habit in habits]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_habit(data: HabitCreate, session: SessionDep, settings: SettingsDep) -> HabitRead:
    try:
        habit = service.create_habit(session, data)
    except GoalUnavailableError:
        raise _goal_not_found() from None
    return _read(habit, {}, settings)


@router.get("/{habit_id}", responses=NOT_FOUND)
def get_habit(habit_id: uuid.UUID, session: SessionDep, settings: SettingsDep) -> HabitRead:
    return _read_one(session, _load(session, habit_id), settings)


@router.patch("/{habit_id}", responses=NOT_FOUND)
def update_habit(
    habit_id: uuid.UUID, changes: HabitUpdate, session: SessionDep, settings: SettingsDep
) -> HabitRead:
    habit = _load(session, habit_id)
    try:
        service.update_habit(session, habit, changes)
    except ValidationError as error:
        raise RequestValidationError(
            error.errors(include_url=False, include_context=False)
        ) from None
    except GoalUnavailableError:
        raise _goal_not_found() from None
    return _read_one(session, habit, settings)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def trash_habit(habit_id: uuid.UUID, session: SessionDep) -> None:
    service.trash_habit(session, _load(session, habit_id), datetime.now(UTC))


@router.post("/{habit_id}/restore", responses=NOT_FOUND)
def restore_habit(habit_id: uuid.UUID, session: SessionDep, settings: SettingsDep) -> HabitRead:
    habit = service.restore_habit(session, _load(session, habit_id, trashed=True))
    return _read_one(session, habit, settings)


@router.put("/{habit_id}/logs/{on_date}", responses=NOT_FOUND)
def write_log(
    habit_id: uuid.UUID,
    on_date: date,
    data: LogWrite,
    session: SessionDep,
    settings: SettingsDep,
) -> HabitRead:
    """Creates or replaces that day's entry and returns the habit's fresh summary."""
    habit = _load(session, habit_id)
    today = local_today(datetime.now(UTC), settings.default_timezone)
    try:
        service.write_log(session, habit, on_date, data, today)
    except service.InvalidLogError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, error.message) from None
    return _read_one(session, habit, settings)


@router.delete("/{habit_id}/logs/{on_date}", responses=NOT_FOUND)
def delete_log(
    habit_id: uuid.UUID, on_date: date, session: SessionDep, settings: SettingsDep
) -> HabitRead:
    habit = _load(session, habit_id)
    service.delete_log(session, habit, on_date)
    return _read_one(session, habit, settings)


@router.get("/{habit_id}/history", responses=NOT_FOUND)
def habit_history(
    habit_id: uuid.UUID,
    session: SessionDep,
    settings: SettingsDep,
    weeks: Annotated[int, Query(ge=1, le=53)] = 12,
) -> list[DayRead]:
    habit = _load(session, habit_id)
    logs = service.logs_by_habit(session, [habit.id])[habit.id]
    today = local_today(datetime.now(UTC), settings.default_timezone)
    start = service.started_on(habit, logs, settings.default_timezone)
    return service.history(habit, logs, today, start, weeks)
