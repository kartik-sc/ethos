import uuid
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.goals.service import ensure_live_goal
from app.habits import rules
from app.habits.models import Habit, HabitLog, Measure
from app.habits.schemas import (
    DayRead,
    HabitCreate,
    HabitSummary,
    HabitUpdate,
    HabitView,
    LogRead,
    LogWrite,
)

RECENT_DAYS = 7
EDITABLE_FIELDS = tuple(HabitCreate.model_fields)


class HabitNotFoundError(Exception):
    pass


class InvalidLogError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def started_on(habit: Habit, logs: Mapping[date, HabitLog], timezone: str) -> date:
    """Creation day, or the earliest entry if the owner backfilled days before that."""
    created = habit.created_at.astimezone(ZoneInfo(timezone)).date()
    return min([created, *logs])


def list_habits(
    session: Session, view: HabitView, goal_id: uuid.UUID | None = None
) -> Sequence[Habit]:
    query = select(Habit)
    if goal_id is not None:
        query = query.where(Habit.goal_id == goal_id)
    if view == "active":
        query = query.where(Habit.deleted_at.is_(None)).order_by(
            Habit.protected.desc(), Habit.created_at
        )
    else:
        query = query.where(Habit.deleted_at.is_not(None)).order_by(Habit.deleted_at.desc())
    return session.scalars(query).all()


def logs_by_habit(
    session: Session, habit_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, dict[date, HabitLog]]:
    """All entries for the given habits; a single owner's history stays small."""
    ids = list(habit_ids)
    result: dict[uuid.UUID, dict[date, HabitLog]] = defaultdict(dict)
    if ids:
        for log in session.scalars(select(HabitLog).where(HabitLog.habit_id.in_(ids))):
            result[log.habit_id][log.on_date] = log
    return result


def _day(
    habit: Habit, day: date, logs: Mapping[date, HabitLog], today: date, start: date
) -> DayRead:
    log = logs.get(day)
    return DayRead(
        date=day,
        state=rules.day_state(habit, day, log, today, start),
        amount=log.amount if log else None,
    )


def summarize(
    habit: Habit, logs: Mapping[date, HabitLog], today: date, start: date
) -> HabitSummary:
    streak, unit = rules.streak(habit, logs, today, start)
    done, target = rules.week_progress(habit, logs, today, start)
    today_log = logs.get(today)
    return HabitSummary(
        today=_day(habit, today, logs, today, start),
        today_log=LogRead.model_validate(today_log) if today_log else None,
        streak=streak,
        streak_unit=unit,
        week_done=done,
        week_target=target,
        recent=[
            _day(habit, today - timedelta(days=offset), logs, today, start)
            for offset in reversed(range(RECENT_DAYS))
        ],
    )


def history(
    habit: Habit, logs: Mapping[date, HabitLog], today: date, start: date, weeks: int
) -> list[DayRead]:
    """Whole weeks, Monday first, ending with the current week (future days included)."""
    first = rules.week_start(today) - timedelta(weeks=weeks - 1)
    return [_day(habit, first + timedelta(days=n), logs, today, start) for n in range(weeks * 7)]


def get_habit(session: Session, habit_id: uuid.UUID, *, trashed: bool = False) -> Habit:
    habit = session.get(Habit, habit_id)
    if habit is None or (habit.deleted_at is not None) != trashed:
        raise HabitNotFoundError
    return habit


def create_habit(session: Session, data: HabitCreate) -> Habit:
    ensure_live_goal(session, data.goal_id)
    habit = Habit(**data.model_dump())
    session.add(habit)
    session.commit()
    return habit


def update_habit(session: Session, habit: Habit, changes: HabitUpdate) -> Habit:
    """Raises pydantic.ValidationError when the merged habit is inconsistent."""
    current = {name: getattr(habit, name) for name in EDITABLE_FIELDS}
    merged = HabitCreate.model_validate({**current, **changes.model_dump(exclude_unset=True)})
    if merged.goal_id != habit.goal_id:
        ensure_live_goal(session, merged.goal_id)
    for name, value in merged.model_dump().items():
        setattr(habit, name, value)
    session.commit()
    session.refresh(habit)
    return habit


def trash_habit(session: Session, habit: Habit, now: datetime) -> None:
    habit.deleted_at = now
    session.commit()


def restore_habit(session: Session, habit: Habit) -> Habit:
    habit.deleted_at = None
    session.commit()
    return habit


def _log_values(habit: Habit, data: LogWrite) -> dict[str, object]:
    if habit.measure is Measure.AMOUNT:
        if data.amount is None:
            raise InvalidLogError(f"Enter an amount in {habit.unit}")
        return {"amount": data.amount, "start_time": None, "end_time": None}
    if habit.measure is Measure.SPAN:
        if data.start_time is None or data.end_time is None:
            raise InvalidLogError("Enter both a start and an end time")
        hours = rules.span_hours(data.start_time, data.end_time)
        return {"amount": hours, "start_time": data.start_time, "end_time": data.end_time}
    return {"amount": None, "start_time": None, "end_time": None}


def write_log(
    session: Session, habit: Habit, on_date: date, data: LogWrite, today: date
) -> HabitLog:
    """Creates or replaces the entry for that day."""
    if on_date > today:
        raise InvalidLogError("Future days can't be logged")
    values = {**_log_values(habit, data), "note": data.note or None}
    statement = (
        insert(HabitLog)
        .values(habit_id=habit.id, on_date=on_date, **values)
        .on_conflict_do_update(
            index_elements=[HabitLog.habit_id, HabitLog.on_date],
            set_={**values, "updated_at": datetime.now(ZoneInfo("UTC"))},
        )
        .returning(HabitLog)
    )
    log = session.scalars(statement, execution_options={"populate_existing": True}).one()
    session.commit()
    return log


def delete_log(session: Session, habit: Habit, on_date: date) -> None:
    session.execute(
        delete(HabitLog).where(HabitLog.habit_id == habit.id, HabitLog.on_date == on_date)
    )
    session.commit()
