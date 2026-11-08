"""Pure slot finding. Nothing here moves an existing block: new work only goes into free time.

All instants are timezone-aware. Day windows are built in the owner's timezone, so a window
keeps its local clock times across daylight-saving changes.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo


@dataclass(frozen=True, order=True)
class Interval:
    start: datetime
    end: datetime

    @property
    def minutes(self) -> int:
        return int((self.end - self.start).total_seconds() // 60)


@dataclass(frozen=True)
class DayWindow:
    starts_at: time
    ends_at: time
    timezone: str

    def on(self, day: date) -> Interval:
        zone = ZoneInfo(self.timezone)
        return Interval(
            datetime.combine(day, self.starts_at, zone), datetime.combine(day, self.ends_at, zone)
        )


@dataclass(frozen=True)
class Request:
    """Work to place: `minutes` long, finished by the end of `deadline` if there is one."""

    key: str
    minutes: int
    deadline: date | None


@dataclass(frozen=True)
class Placement:
    key: str
    slot: Interval


@dataclass(frozen=True)
class Unplaced:
    key: str
    minutes: int
    reason: str


def free_intervals(
    window: Interval, busy: Iterable[Interval], not_before: datetime
) -> list[Interval]:
    """Gaps inside `window`, after `not_before`, that no busy interval touches."""
    cursor = max(window.start, not_before)
    free: list[Interval] = []
    for block in sorted(busy):
        if block.end <= cursor or block.start >= window.end:
            continue
        if block.start > cursor:
            free.append(Interval(cursor, min(block.start, window.end)))
        cursor = max(cursor, block.end)
        if cursor >= window.end:
            break
    if cursor < window.end:
        free.append(Interval(cursor, window.end))
    return free


def first_fit(free: Iterable[Interval], minutes: int) -> Interval | None:
    length = timedelta(minutes=minutes)
    for gap in free:
        if gap.end - gap.start >= length:
            return Interval(gap.start, gap.start + length)
    return None


def _round_up(moment: datetime, step_minutes: int) -> datetime:
    """Blocks start on a clean boundary (e.g. :00, :15) rather than the second it is now."""
    base = moment.replace(second=0, microsecond=0)
    if base < moment:
        base += timedelta(minutes=1)
    overshoot = base.minute % step_minutes
    return base if overshoot == 0 else base + timedelta(minutes=step_minutes - overshoot)


def find_slot(
    days: Iterable[date],
    window: DayWindow,
    busy: Sequence[Interval],
    minutes: int,
    now: datetime,
    step_minutes: int = 15,
) -> Interval | None:
    not_before = _round_up(now, step_minutes)
    for day in days:
        slot = first_fit(free_intervals(window.on(day), busy, not_before), minutes)
        if slot is not None:
            return slot
    return None


def plan(
    requests: Sequence[Request],
    today: date,
    horizon_days: int,
    window: DayWindow,
    busy: Sequence[Interval],
    now: datetime,
) -> tuple[list[Placement], list[Unplaced]]:
    """Places requests in the given order, each in the earliest free slot that ends by its
    deadline (or within the horizon). What cannot fit is reported, never squeezed in."""
    taken = list(busy)
    placed: list[Placement] = []
    unplaced: list[Unplaced] = []
    window_minutes = window.on(today).minutes
    for request in requests:
        if request.minutes > window_minutes:
            unplaced.append(Unplaced(request.key, request.minutes, "longer than the working day"))
            continue
        last = today + timedelta(days=horizon_days - 1)
        if request.deadline is not None:
            if request.deadline < today:
                unplaced.append(Unplaced(request.key, request.minutes, "deadline has passed"))
                continue
            last = min(last, request.deadline)
        days = [today + timedelta(days=offset) for offset in range((last - today).days + 1)]
        slot = find_slot(days, window, taken, request.minutes, now)
        if slot is None:
            reason = "no free slot before the deadline" if request.deadline else "no free slot"
            unplaced.append(Unplaced(request.key, request.minutes, reason))
            continue
        placed.append(Placement(request.key, slot))
        taken.append(slot)
    return placed, unplaced
