"""Pure analytics rules: reporting windows and factual observations. No I/O.

Observations state what the numbers show. They never advise, praise or motivate (spec 4.11).
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

Period = Literal["week", "month"]

MAX_WEEKS_BACK = 104
MAX_MONTHS_BACK = 24


@dataclass(frozen=True)
class Window:
    start: date
    # Inclusive.
    end: date

    @property
    def days(self) -> list[date]:
        return [self.start + timedelta(days=n) for n in range((self.end - self.start).days + 1)]


def window(period: Period, today: date, offset: int) -> Window:
    """The week (Monday to Sunday) or calendar month containing today, shifted by offset (<= 0)."""
    if period == "week":
        monday = today - timedelta(days=today.weekday()) + timedelta(weeks=offset)
        return Window(monday, monday + timedelta(days=6))
    month_index = today.year * 12 + (today.month - 1) + offset
    start = date(month_index // 12, month_index % 12 + 1, 1)
    next_index = month_index + 1
    end = date(next_index // 12, next_index % 12 + 1, 1) - timedelta(days=1)
    return Window(start, end)


EN_DASH = chr(0x2013)  # date ranges are typeset with an en dash


def label(period: Period, span: Window) -> str:
    if period == "month":
        return span.start.strftime("%B %Y")
    if span.start.month == span.end.month:
        return f"{span.start.day}{EN_DASH}{span.end.day} {span.end:%b %Y}"
    return f"{span.start.day} {span.start:%b} {EN_DASH} {span.end.day} {span.end:%b %Y}"


@dataclass(frozen=True)
class HabitLine:
    title: str
    done: int
    expected: int
    # Still possible this week or today; nothing is "done every time" while this is open.
    open: int = 0


@dataclass(frozen=True)
class Facts:
    period: Period
    is_current: bool
    completed: int
    previous_completed: int
    deadlines_met: int
    deadlines_missed: int
    overdue_now: int
    top_area: tuple[str, int] | None
    habits: list[HabitLine]
    inbox_open: int
    oldest_open_days: int | None


def _plural(count: int, singular: str, plural: str | None = None) -> str:
    return f"{count} {singular if count == 1 else (plural or singular + 's')}"


def observations(facts: Facts) -> list[str]:
    """Up to six plain statements, most significant first."""
    noun = "week" if facts.period == "week" else "month"
    lines: list[str] = []

    difference = facts.completed - facts.previous_completed
    if facts.completed or facts.previous_completed:
        if difference == 0:
            comparison = f"the same as last {noun}"
        else:
            comparison = (
                f"{abs(difference)} {'more' if difference > 0 else 'fewer'} than last {noun}"
            )
        lines.append(f"Completed {_plural(facts.completed, 'task')}, {comparison}.")

    due = facts.deadlines_met + facts.deadlines_missed
    if due:
        lines.append(
            f"Met {facts.deadlines_met} of {_plural(due, 'deadline')} that fell in this {noun}."
        )

    if facts.is_current and facts.overdue_now:
        verb = "is" if facts.overdue_now == 1 else "are"
        lines.append(f"{_plural(facts.overdue_now, 'task')} {verb} overdue now.")

    if facts.top_area is not None and facts.completed >= 3:
        area, count = facts.top_area
        if count * 2 > facts.completed:
            lines.append(f"Most completed tasks were in {area} ({count} of {facts.completed}).")

    for habit in sorted(facts.habits, key=lambda h: h.done / h.expected if h.expected else 1):
        if habit.expected < 2:
            continue
        if habit.done >= habit.expected and habit.open == 0:
            lines.append(
                f"{habit.title}: done every time it was due ({habit.expected} of {habit.expected})."
            )
        elif habit.done * 2 < habit.expected:
            lines.append(f"{habit.title}: {habit.done} of {habit.expected} expected.")

    if facts.is_current and facts.inbox_open:
        waiting = f"{_plural(facts.inbox_open, 'capture')} waiting in the Inbox"
        if facts.oldest_open_days:
            waiting += f"; the oldest is {_plural(facts.oldest_open_days, 'day')} old"
        lines.append(waiting + ".")

    return lines[:6]
