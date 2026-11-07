from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from statistics import median
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics import rules
from app.analytics.rules import Period, Window
from app.analytics.schemas import AnalyticsReport, AreaCount, DayCount, HabitAdherence, Totals
from app.habits import rules as habit_rules
from app.habits.models import Cadence, Habit, HabitLog
from app.habits.service import logs_by_habit, started_on
from app.inbox.models import InboxItem
from app.notes.models import NoteVersion
from app.tasks.models import Task, TaskStatus


def _bounds(span: Window, zone: ZoneInfo) -> tuple[datetime, datetime]:
    """The window as an instant range [start, end) in UTC terms."""
    start = datetime.combine(span.start, time.min, tzinfo=zone)
    end = datetime.combine(span.end + timedelta(days=1), time.min, tzinfo=zone)
    return start, end


def _local(moment: datetime, zone: ZoneInfo) -> date:
    return moment.astimezone(zone).date()


@dataclass(frozen=True)
class Adherence:
    done: int
    # Scheduled days (or weekly targets) that have come due inside the window.
    expected: int
    # Still possible before the window's current day or week ends: today's entry, or the
    # sessions left in a week that is still running. Never counted as missed.
    open: int = 0


def habit_adherence(
    habit: Habit, logs: Mapping[date, HabitLog], span: Window, today: date, start: date
) -> Adherence:
    """Adherence inside the window. Today and the current week only count once done."""
    first = max(span.start, start)
    last = min(span.end, today)
    if first > last:
        return Adherence(0, 0)

    if habit.cadence is Cadence.DAILY:
        done = expected = still_open = 0
        for day in Window(first, last).days:
            if not habit_rules.is_scheduled(habit, day):
                continue
            met = habit_rules.is_met(habit, logs.get(day))
            if day < today or met:
                expected += 1
                done += int(met)
            else:
                still_open += 1
        return Adherence(done, expected, still_open)

    target = habit.times_per_week or 0
    done = expected = still_open = 0
    monday = habit_rules.week_start(first)
    if monday < span.start:
        monday += timedelta(weeks=1)  # weeks belong to the window their Monday falls in
    while monday <= last:
        week = [monday + timedelta(days=n) for n in range(7)]
        met_count = min(target, sum(1 for day in week if habit_rules.is_met(habit, logs.get(day))))
        finished = monday + timedelta(days=6) < today
        done += met_count
        if finished and monday >= start:
            expected += target
        else:
            # A running week, or one the habit joined part-way, only counts what was done.
            expected += met_count
            if not finished:
                still_open += target - met_count
        monday += timedelta(weeks=1)
    return Adherence(done, expected, still_open)


def _totals(session: Session, span: Window, today: date, zone: ZoneInfo) -> Totals:
    start, end = _bounds(span, zone)
    live = Task.deleted_at.is_(None)
    completed = session.scalar(
        select(func.count()).where(
            live,
            Task.status == TaskStatus.DONE,
            Task.completed_at >= start,
            Task.completed_at < end,
        )
    )
    cancelled = session.scalar(
        select(func.count()).where(
            live,
            Task.status == TaskStatus.CANCELLED,
            Task.cancelled_at >= start,
            Task.cancelled_at < end,
        )
    )
    created = session.scalar(
        select(func.count()).where(live, Task.created_at >= start, Task.created_at < end)
    )

    met = missed = 0
    for due, status, completed_at in session.execute(
        select(Task.due_date, Task.status, Task.completed_at).where(
            live,
            Task.status != TaskStatus.CANCELLED,
            Task.due_date >= span.start,
            Task.due_date <= span.end,
        )
    ):
        if due is None:
            continue
        if (
            status is TaskStatus.DONE
            and completed_at is not None
            and _local(completed_at, zone) <= due
        ):
            met += 1
        elif due < today:
            missed += 1

    habit_done = habit_expected = 0
    for _, adherence in _habit_lines(session, span, today, zone):
        habit_done += adherence.done
        habit_expected += adherence.expected

    captured = session.scalar(
        select(func.count()).where(InboxItem.created_at >= start, InboxItem.created_at < end)
    )
    processed = session.scalar(
        select(func.count()).where(InboxItem.processed_at >= start, InboxItem.processed_at < end)
    )
    notes_edited = session.scalar(
        select(func.count(func.distinct(NoteVersion.note_id))).where(
            NoteVersion.saved_at >= start, NoteVersion.saved_at < end
        )
    )
    return Totals(
        completed=completed or 0,
        cancelled=cancelled or 0,
        created=created or 0,
        deadlines_met=met,
        deadlines_missed=missed,
        habit_done=habit_done,
        habit_expected=habit_expected,
        captured=captured or 0,
        processed=processed or 0,
        notes_edited=notes_edited or 0,
    )


def _habit_lines(
    session: Session, span: Window, today: date, zone: ZoneInfo
) -> list[tuple[Habit, Adherence]]:
    habits = session.scalars(
        select(Habit)
        .where(Habit.deleted_at.is_(None))
        .order_by(Habit.protected.desc(), Habit.created_at)
    ).all()
    logs = logs_by_habit(session, (habit.id for habit in habits))
    lines = []
    for habit in habits:
        habit_logs = logs[habit.id]
        start = started_on(habit, habit_logs, str(zone))
        adherence = habit_adherence(habit, habit_logs, span, today, start)
        if adherence.expected or adherence.open:
            lines.append((habit, adherence))
    return lines


def report(
    session: Session, period: Period, offset: int, now: datetime, timezone: str
) -> AnalyticsReport:
    zone = ZoneInfo(timezone)
    today = _local(now, zone)
    span = rules.window(period, today, offset)
    previous_span = rules.window(period, today, offset - 1)
    start, end = _bounds(span, zone)
    is_current = offset == 0

    totals = _totals(session, span, today, zone)
    previous = _totals(session, previous_span, today, zone)

    done_tasks = session.execute(
        select(Task.completed_at, Task.area).where(
            Task.deleted_at.is_(None),
            Task.status == TaskStatus.DONE,
            Task.completed_at >= start,
            Task.completed_at < end,
        )
    ).all()
    per_day = Counter(
        _local(completed_at, zone) for completed_at, _ in done_tasks if completed_at is not None
    )
    per_area = Counter(area for _, area in done_tasks)

    habit_lines = _habit_lines(session, span, today, zone)

    hours = [
        (processed_at - created_at).total_seconds() / 3600
        for created_at, processed_at in session.execute(
            select(InboxItem.created_at, InboxItem.processed_at).where(
                InboxItem.processed_at >= start, InboxItem.processed_at < end
            )
        )
        if processed_at is not None
    ]
    open_items = session.scalars(
        select(InboxItem.created_at).where(InboxItem.processed_at.is_(None))
    ).all()
    overdue_now = (
        session.scalar(
            select(func.count()).where(
                Task.deleted_at.is_(None), Task.status == TaskStatus.OPEN, Task.due_date < today
            )
        )
        or 0
    )

    named_areas = [
        (area.value, count) for area, count in per_area.most_common() if area is not None
    ]
    facts = rules.Facts(
        period=period,
        is_current=is_current,
        completed=totals.completed,
        previous_completed=previous.completed,
        deadlines_met=totals.deadlines_met,
        deadlines_missed=totals.deadlines_missed,
        overdue_now=overdue_now,
        top_area=named_areas[0] if named_areas else None,
        habits=[
            rules.HabitLine(habit.title, line.done, line.expected, line.open)
            for habit, line in habit_lines
        ],
        inbox_open=len(open_items),
        oldest_open_days=(today - _local(min(open_items), zone)).days if open_items else None,
    )

    return AnalyticsReport(
        period=period,
        offset=offset,
        label=rules.label(period, span),
        start=span.start,
        end=span.end,
        is_current=is_current,
        totals=totals,
        previous=previous,
        completed_by_day=[DayCount(date=day, count=per_day.get(day, 0)) for day in span.days],
        completed_by_area=[
            AreaCount(area=area, count=count)
            for area, count in sorted(per_area.items(), key=lambda item: (-item[1], str(item[0])))
        ],
        habits=[
            HabitAdherence(
                id=habit.id,
                title=habit.title,
                done=line.done,
                expected=line.expected,
                open=line.open,
            )
            for habit, line in habit_lines
        ],
        inbox_median_hours=round(median(hours), 1) if hours else None,
        overdue_now=overdue_now,
        inbox_open=len(open_items),
        observations=rules.observations(facts),
    )
