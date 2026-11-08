import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.calendar import slots
from app.calendar.models import BlockKind, BlockStatus, CalendarBlock, SyncOp
from app.calendar.schemas import BlockRead, PlannedBlock, PlanResult, SyncState, UnplacedTask
from app.core.clock import local_today
from app.habits.models import Habit
from app.preferences.models import Preferences
from app.tasks.models import Task, TaskStatus
from app.tasks.service import rank_key

# Any constant works; it only has to be the same everywhere bookings are made.
SCHEDULING_LOCK = 0x4554_484F


def lock_schedule(session: Session) -> None:
    """Serialises everything that books time (worker refresh, planning, scheduling) until the
    transaction ends, so two of them can never both see a slot as free and both take it."""
    session.execute(select(func.pg_advisory_xact_lock(SCHEDULING_LOCK)))


class BlockNotFoundError(Exception):
    pass


class NoSlotError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message


class AlreadyScheduledError(Exception):
    def __init__(self, block: CalendarBlock) -> None:
        self.block = block


@dataclass(frozen=True)
class Context:
    """What scheduling needs to know about the owner and the moment."""

    now: datetime
    timezone: str
    window: slots.DayWindow
    default_minutes: int

    @property
    def today(self) -> date:
        return local_today(self.now, self.timezone)

    @classmethod
    def of(cls, preferences: Preferences, now: datetime) -> "Context":
        return cls(
            now=now,
            timezone=preferences.timezone,
            window=slots.DayWindow(
                preferences.day_starts_at, preferences.day_ends_at, preferences.timezone
            ),
            default_minutes=preferences.default_task_minutes,
        )


MAX_SYNC_ATTEMPTS = 5


def sync_state(block: CalendarBlock) -> SyncState:
    if block.sync_op is None:
        return "synced"
    return "failed" if block.sync_attempts >= MAX_SYNC_ATTEMPTS else "pending"


def read(block: CalendarBlock) -> BlockRead:
    fields = {name: getattr(block, name) for name in BlockRead.model_fields if name != "sync"}
    return BlockRead(**fields, sync=sync_state(block))


def _visible() -> Select[CalendarBlock]:
    """Blocks that occupy time: not removed, and not for a task or habit in Trash."""
    return (
        select(CalendarBlock)
        .outerjoin(Task, Task.id == CalendarBlock.task_id)
        .outerjoin(Habit, Habit.id == CalendarBlock.habit_id)
        .where(
            CalendarBlock.status != BlockStatus.CANCELLED,
            or_(CalendarBlock.sync_op.is_(None), CalendarBlock.sync_op != SyncOp.DELETE),
            Task.deleted_at.is_(None),
            Habit.deleted_at.is_(None),
        )
    )


def local_range(start: date, end: date, timezone: str) -> tuple[datetime, datetime]:
    zone = ZoneInfo(timezone)
    return (
        datetime.combine(start, time.min, zone),
        datetime.combine(end + timedelta(days=1), time.min, zone),
    )


def list_blocks(session: Session, start: datetime, end: datetime) -> Sequence[CalendarBlock]:
    return session.scalars(
        _visible()
        .where(CalendarBlock.starts_at < end, CalendarBlock.ends_at > start)
        .order_by(CalendarBlock.starts_at)
    ).all()


def busy(session: Session, start: datetime, end: datetime) -> list[slots.Interval]:
    return [
        slots.Interval(block.starts_at, block.ends_at)
        for block in list_blocks(session, start, end)
        if block.status is not BlockStatus.MISSED
    ]


def pending_count(session: Session) -> int:
    return (
        session.scalar(
            select(func.count())
            .select_from(CalendarBlock)
            .where(CalendarBlock.sync_op.is_not(None))
        )
        or 0
    )


def _upcoming_block(session: Session, task_id: uuid.UUID, now: datetime) -> CalendarBlock | None:
    return session.scalars(
        _visible()
        .where(
            CalendarBlock.task_id == task_id,
            CalendarBlock.ends_at > now,
            CalendarBlock.status == BlockStatus.SCHEDULED,
        )
        .order_by(CalendarBlock.starts_at)
    ).first()


def _minutes(task: Task, context: Context) -> int:
    return task.planned_minutes or context.default_minutes


def _create(session: Session, task: Task, slot: slots.Interval) -> CalendarBlock:
    block = CalendarBlock(
        kind=BlockKind.TASK,
        title=task.title,
        starts_at=slot.start.astimezone(UTC),
        ends_at=slot.end.astimezone(UTC),
        task_id=task.id,
        sync_op=SyncOp.CREATE,
    )
    session.add(block)
    return block


def schedule_task(
    session: Session, task: Task, context: Context, horizon_days: int = 14
) -> CalendarBlock:
    """Puts one block for the task in the earliest free slot before its deadline.

    An overdue task can still be scheduled when the owner asks; it is just no longer bound
    by a deadline that has passed.
    """
    lock_schedule(session)
    existing = _upcoming_block(session, task.id, context.now)
    if existing is not None:
        raise AlreadyScheduledError(existing)
    today = context.today
    deadline = task.due_date if task.due_date and task.due_date >= today else None
    start, end = local_range(today, today + timedelta(days=horizon_days), context.timezone)
    request = slots.Request(str(task.id), _minutes(task, context), deadline)
    placed, unplaced = slots.plan(
        [request], today, horizon_days, context.window, busy(session, start, end), context.now
    )
    if unplaced:
        miss = unplaced[0]
        when = f" before {deadline:%a %d %b}" if deadline else f" in the next {horizon_days} days"
        reason = (
            "It is longer than the working day in Settings"
            if miss.reason == "longer than the working day"
            else f"No free {miss.minutes}-minute slot{when}"
        )
        raise NoSlotError(reason)
    block = _create(session, task, placed[0].slot)
    session.commit()
    return block


def _plan_candidates(session: Session, context: Context, horizon_days: int) -> list[Task]:
    """Open tasks that ask to be scheduled: due within the horizon or given a duration,
    and without an upcoming block already. Overdue tasks are reported, not rescheduled."""
    last = context.today + timedelta(days=horizon_days - 1)
    tasks = session.scalars(
        select(Task).where(
            Task.status == TaskStatus.OPEN,
            Task.deleted_at.is_(None),
            or_(Task.due_date <= last, Task.planned_minutes.is_not(None)),
        )
    ).all()
    candidates = [task for task in tasks if _upcoming_block(session, task.id, context.now) is None]
    return sorted(candidates, key=lambda task: rank_key(task, context.today))


def plan_tasks(session: Session, context: Context, horizon_days: int, *, apply: bool) -> PlanResult:
    if apply:
        lock_schedule(session)
    tasks = {str(task.id): task for task in _plan_candidates(session, context, horizon_days)}
    today = context.today
    requests = [
        slots.Request(key, _minutes(task, context), task.due_date) for key, task in tasks.items()
    ]
    start, end = local_range(today, today + timedelta(days=horizon_days), context.timezone)
    placed, unplaced = slots.plan(
        requests, today, horizon_days, context.window, busy(session, start, end), context.now
    )
    if apply:
        for placement in placed:
            _create(session, tasks[placement.key], placement.slot)
        session.commit()
    return PlanResult(
        applied=apply,
        placed=[
            PlannedBlock(
                task_id=tasks[p.key].id,
                title=tasks[p.key].title,
                starts_at=p.slot.start.astimezone(UTC),
                ends_at=p.slot.end.astimezone(UTC),
            )
            for p in placed
        ],
        unplaced=[
            UnplacedTask(
                task_id=tasks[u.key].id,
                title=tasks[u.key].title,
                minutes=u.minutes,
                due_date=tasks[u.key].due_date,
                reason=u.reason,
            )
            for u in unplaced
        ],
    )


def get_block(session: Session, block_id: uuid.UUID) -> CalendarBlock:
    block = session.get(CalendarBlock, block_id)
    if block is None or block.sync_op is SyncOp.DELETE or block.status is BlockStatus.CANCELLED:
        raise BlockNotFoundError
    return block


class FixedBlockError(Exception):
    pass


def release(session: Session, block: CalendarBlock) -> None:
    """Gives a block's time back: deleted if Google never saw it, else hidden and its deletion
    queued."""
    if block.external_id is None:
        session.delete(block)
    else:
        block.sync_op = SyncOp.DELETE
        block.status = BlockStatus.CANCELLED
        block.sync_error = None
        block.sync_attempts = 0
    session.flush()


def release_task_blocks(session: Session, task_ids: Sequence[uuid.UUID], now: datetime) -> int:
    """Frees the upcoming blocks of tasks that were closed or trashed. Past blocks stay as
    history. Without this, restoring a task would bring its old blocks back on top of work
    booked into the freed time since."""
    if not task_ids:
        return 0
    lock_schedule(session)
    blocks = session.scalars(
        select(CalendarBlock).where(
            CalendarBlock.task_id.in_(task_ids),
            CalendarBlock.status == BlockStatus.SCHEDULED,
            CalendarBlock.starts_at > now,
        )
    ).all()
    for block in blocks:
        release(session, block)
    session.commit()
    return len(blocks)


def remove_block(session: Session, block: CalendarBlock) -> None:
    """Fixed blocks stay. A removed habit session is kept as cancelled so it is not booked
    again that day. Otherwise a block Google never saw is deleted, or its deletion queued."""
    if block.fixed or block.kind is BlockKind.EVENT:
        raise FixedBlockError
    if block.kind is BlockKind.HABIT:
        block.status = BlockStatus.CANCELLED
        block.sync_op = None if block.external_id is None else SyncOp.DELETE
        block.sync_error = None
        block.sync_attempts = 0
    elif block.external_id is None:
        session.delete(block)
    else:
        block.sync_op = SyncOp.DELETE
        block.sync_error = None
        block.sync_attempts = 0
    session.commit()
