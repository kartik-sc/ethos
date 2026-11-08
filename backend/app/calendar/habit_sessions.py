"""Booking habit sessions, settling them once they pass, and the two missed-session rules.

- A protected daily habit (the two-hour LeetCode session) that is missed gets another slot
  later the same day, at full length, retried until one frees up or the day ends. If none is
  free it stays missed and is reported. Never tomorrow.
- A weekly habit that falls behind spreads its remaining sessions over the rest of the week,
  around everything already booked. What cannot fit is reported, not squeezed in.
- Every other missed session simply stays missed.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.calendar import slots
from app.calendar.models import BlockKind, BlockStatus, CalendarBlock, SyncOp
from app.calendar.service import Context, busy, local_range, lock_schedule, release
from app.habits.models import Cadence, Habit, HabitLog
from app.habits.rules import is_met, is_scheduled, week_start


@dataclass(frozen=True)
class Unbooked:
    habit_id: str
    title: str
    day: date
    minutes: int


@dataclass
class Report:
    done: int = 0
    missed: int = 0
    recovered: int = 0
    booked: int = 0
    unbooked: list[Unbooked] = field(default_factory=list)


def _local_day(moment: datetime, timezone: str) -> date:
    return moment.astimezone(ZoneInfo(timezone)).date()


def _scheduled_habits(session: Session) -> Sequence[Habit]:
    return session.scalars(
        select(Habit).where(Habit.deleted_at.is_(None), Habit.session_minutes.is_not(None))
    ).all()


def _met_days(session: Session, habit: Habit, first: date, last: date) -> set[date]:
    logs = session.scalars(
        select(HabitLog).where(
            HabitLog.habit_id == habit.id, HabitLog.on_date >= first, HabitLog.on_date <= last
        )
    ).all()
    return {log.on_date for log in logs if is_met(habit, log)}


def _habit_blocks(
    session: Session, habit: Habit, start: datetime, end: datetime
) -> Sequence[CalendarBlock]:
    return session.scalars(
        select(CalendarBlock).where(
            CalendarBlock.habit_id == habit.id,
            CalendarBlock.starts_at < end,
            CalendarBlock.ends_at > start,
        )
    ).all()


def _book(
    session: Session, habit: Habit, slot: slots.Interval, recovers: CalendarBlock | None = None
) -> CalendarBlock:
    block = CalendarBlock(
        kind=BlockKind.HABIT,
        title=habit.title,
        starts_at=slot.start.astimezone(UTC),
        ends_at=slot.end.astimezone(UTC),
        habit_id=habit.id,
        fixed=habit.protected,
        recovers_id=recovers.id if recovers else None,
        sync_op=SyncOp.CREATE,
    )
    session.add(block)
    session.flush()
    return block


def _slot_on(session: Session, habit: Habit, day: date, context: Context) -> slots.Interval | None:
    """The preferred time if it is free and still ahead, else the first free slot that day."""
    minutes = habit.session_minutes or 0
    day_start, day_end = local_range(day, day, context.timezone)
    taken = busy(session, day_start, day_end)
    if habit.session_time is not None:
        start = datetime.combine(day, habit.session_time, ZoneInfo(context.timezone))
        preferred = slots.Interval(start, start + timedelta(minutes=minutes))
        clear = all(b.end <= preferred.start or b.start >= preferred.end for b in taken)
        if clear and preferred.start >= context.now and preferred.end <= day_end:
            return preferred
    return slots.find_slot([day], context.window, taken, minutes, context.now)


def settle(session: Session, context: Context, report: Report) -> None:
    """Marks habit sessions done when the day's entry meets the habit, and missed once they
    end without it."""
    since = context.now - timedelta(days=7)
    _, end_of_today = local_range(context.today, context.today, context.timezone)
    blocks = session.scalars(
        select(CalendarBlock)
        .where(
            CalendarBlock.kind == BlockKind.HABIT,
            CalendarBlock.status.in_([BlockStatus.SCHEDULED, BlockStatus.MISSED]),
            CalendarBlock.starts_at < end_of_today,
            CalendarBlock.starts_at >= since,
        )
        .order_by(CalendarBlock.starts_at)
    ).all()
    for block in blocks:
        habit = session.get(Habit, block.habit_id)
        if habit is None:
            continue
        day = _local_day(block.starts_at, context.timezone)
        if day in _met_days(session, habit, day, day):
            block.status = BlockStatus.DONE
            report.done += 1
        elif block.status is BlockStatus.SCHEDULED and block.ends_at <= context.now:
            block.status = BlockStatus.MISSED
            report.missed += 1
    session.flush()


def _recover(session: Session, habit: Habit, context: Context, report: Report) -> None:
    """A protected daily habit whose session today was missed gets another full-length slot
    later today. Tried on every refresh, so time freed later in the day is still used; never
    tomorrow."""
    today = context.today
    if not is_scheduled(habit, today) or today in _met_days(session, habit, today, today):
        return
    start, end = local_range(today, today, context.timezone)
    blocks = [
        block
        for block in _habit_blocks(session, habit, start, end)
        if block.status is not BlockStatus.CANCELLED
    ]
    missed = [block for block in blocks if block.status is BlockStatus.MISSED]
    if not missed or len(missed) < len(blocks):
        return  # nothing missed yet, or a session is still booked or done
    slot = _slot_on(session, habit, today, context)
    if slot is None:
        report.unbooked.append(
            Unbooked(str(habit.id), habit.title, today, habit.session_minutes or 0)
        )
        return
    _book(session, habit, slot, recovers=max(missed, key=lambda block: block.starts_at))
    report.recovered += 1


def _spread(days: Sequence[date], count: int) -> list[date]:
    """`count` of `days`, evenly spaced and starting with the first."""
    if count >= len(days):
        return list(days)
    step = len(days) / count
    return [days[int(index * step)] for index in range(count)]


def _book_daily(
    session: Session, habit: Habit, context: Context, through: date, report: Report
) -> None:
    today = context.today
    start, end = local_range(today, through, context.timezone)
    met = _met_days(session, habit, today, through)
    booked = {
        _local_day(block.starts_at, context.timezone)
        for block in _habit_blocks(session, habit, start, end)
    }
    day = today
    while day <= through:
        if is_scheduled(habit, day) and day not in met and day not in booked:
            slot = _slot_on(session, habit, day, context)
            if slot is None:
                minutes = habit.session_minutes or 0
                report.unbooked.append(Unbooked(str(habit.id), habit.title, day, minutes))
            else:
                _book(session, habit, slot)
                report.booked += 1
        day += timedelta(days=1)


def _book_weekly(session: Session, habit: Habit, context: Context, report: Report) -> None:
    """Keeps the weekly target reachable: the sessions still owed this week are spread over
    the days left, skipping days that already have an entry or a session."""
    today = context.today
    monday = week_start(today)
    sunday = monday + timedelta(days=6)
    met = _met_days(session, habit, monday, sunday)
    start, end = local_range(today, sunday, context.timezone)
    blocks = _habit_blocks(session, habit, start, end)
    upcoming = [
        block
        for block in blocks
        if block.status is BlockStatus.SCHEDULED and block.ends_at > context.now
    ]
    owed = (habit.times_per_week or 0) - len(met) - len(upcoming)
    if owed < 0:
        # The target is already in reach: later sessions that haven't started give their time
        # back instead of sitting in the calendar as unwanted blocks.
        later = sorted(
            (block for block in upcoming if block.starts_at > context.now),
            key=lambda block: block.starts_at,
            reverse=True,
        )
        for block in later[:-owed]:
            release(session, block)
        return
    if owed == 0:
        return
    used = met | {_local_day(block.starts_at, context.timezone) for block in blocks}
    open_days = [today + timedelta(days=n) for n in range((sunday - today).days + 1)]
    candidates = [day for day in open_days if day not in used]
    placed = 0
    for day in _spread(candidates, owed):
        slot = _slot_on(session, habit, day, context)
        if slot is not None:
            _book(session, habit, slot)
            placed += 1
    # Days skipped by the even spread get a second chance before anything is reported.
    for day in candidates:
        if placed >= owed:
            break
        if any(
            _local_day(block.starts_at, context.timezone) == day
            for block in _habit_blocks(session, habit, start, end)
        ):
            continue
        slot = _slot_on(session, habit, day, context)
        if slot is not None:
            _book(session, habit, slot)
            placed += 1
    report.booked += placed
    if placed < owed:
        minutes = habit.session_minutes or 0
        for _ in range(owed - placed):
            report.unbooked.append(Unbooked(str(habit.id), habit.title, sunday, minutes))


def refresh(session: Session, context: Context, through: date | None = None) -> Report:
    """Settles past sessions, then books what is due from today through `through`."""
    lock_schedule(session)
    report = Report()
    settle(session, context, report)
    last = through or context.today
    for habit in _scheduled_habits(session):
        if habit.cadence is Cadence.DAILY:
            if habit.protected:
                _recover(session, habit, context, report)
            _book_daily(session, habit, context, last, report)
        else:
            _book_weekly(session, habit, context, report)
    session.commit()
    return report


def unbooked_today(session: Session, context: Context) -> list[Unbooked]:
    """Daily sessions due today that are neither done nor booked, e.g. because no slot was free.
    Read-only, so the agenda can show them without waiting for the worker."""
    today = context.today
    start, end = local_range(today, today, context.timezone)
    missing = []
    for habit in _scheduled_habits(session):
        if habit.cadence is not Cadence.DAILY or not is_scheduled(habit, today):
            continue
        if today in _met_days(session, habit, today, today):
            continue
        blocks = _habit_blocks(session, habit, start, end)
        if any(block.status is BlockStatus.CANCELLED for block in blocks):
            continue  # the owner removed today's session
        if any(block.status is not BlockStatus.MISSED for block in blocks):
            continue
        # Only missed sessions: an ordinary habit just stays missed; a protected one is owed
        # a same-day recovery that could not be booked.
        if not blocks or habit.protected:
            missing.append(Unbooked(str(habit.id), habit.title, today, habit.session_minutes or 0))
    return missing


def release_future(session: Session, now: datetime, habit_id: uuid.UUID | None = None) -> int:
    """Frees habit sessions that have not started, so they are booked again at the same local
    clock time after a timezone, working-day or session change."""
    query = select(CalendarBlock).where(
        CalendarBlock.kind == BlockKind.HABIT,
        CalendarBlock.status == BlockStatus.SCHEDULED,
        CalendarBlock.starts_at > now,
    )
    if habit_id is not None:
        query = query.where(CalendarBlock.habit_id == habit_id)
    lock_schedule(session)
    blocks = session.scalars(query).all()
    for block in blocks:
        release(session, block)
    session.commit()
    return len(blocks)
