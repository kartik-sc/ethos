"""Pure habit rules: what a day means, streaks and weekly progress. No I/O."""

from collections.abc import Mapping
from datetime import date, time, timedelta
from decimal import Decimal
from typing import Literal

from app.habits.models import Cadence, Habit, HabitLog, Measure

DayState = Literal["met", "partial", "missed", "pending", "rest", "future", "inactive"]

STREAK_LOOKBACK_DAYS = 3660


def span_hours(start: time, end: time) -> Decimal:
    """Hours from start to end, crossing midnight when end is earlier (bedtime → wake time)."""
    start_minutes = start.hour * 60 + start.minute
    end_minutes = end.hour * 60 + end.minute
    minutes = (end_minutes - start_minutes) % (24 * 60)
    return (Decimal(minutes) / 60).quantize(Decimal("0.01"))


def is_met(habit: Habit, log: HabitLog | None) -> bool:
    if log is None:
        return False
    if habit.measure is Measure.CHECK or habit.target_amount is None:
        return True
    return log.amount is not None and log.amount >= habit.target_amount


def is_scheduled(habit: Habit, day: date) -> bool:
    """Daily habits expect an entry on their weekdays; weekly habits never expect a given day."""
    return habit.cadence is Cadence.DAILY and day.weekday() in (habit.weekdays or [])


def day_state(
    habit: Habit, day: date, log: HabitLog | None, today: date, started_on: date
) -> DayState:
    if day > today:
        return "future"
    if day < started_on and log is None:
        return "inactive"
    if is_met(habit, log):
        return "met"
    if log is not None:
        return "partial"
    if not is_scheduled(habit, day):
        return "rest"
    return "pending" if day == today else "missed"


def week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def week_progress(
    habit: Habit, logs: Mapping[date, HabitLog], today: date, started_on: date
) -> tuple[int, int]:
    """(done, target) for the week containing `today`."""
    monday = week_start(today)
    days = [monday + timedelta(days=offset) for offset in range(7)]
    done = sum(1 for day in days if day <= today and is_met(habit, logs.get(day)))
    if habit.cadence is Cadence.WEEKLY:
        return done, habit.times_per_week or 0
    target = sum(1 for day in days if day >= started_on and is_scheduled(habit, day))
    return done, target


def _daily_streak(
    habit: Habit, logs: Mapping[date, HabitLog], today: date, started_on: date
) -> int:
    streak = 0
    for offset in range(STREAK_LOOKBACK_DAYS):
        day = today - timedelta(days=offset)
        if day < started_on:
            break
        met = is_met(habit, logs.get(day))
        if met:
            streak += 1
        elif not is_scheduled(habit, day) or day == today:
            # Rest days and a not-yet-finished today neither extend nor break a streak.
            continue
        else:
            break
    return streak


def _weekly_streak(
    habit: Habit, logs: Mapping[date, HabitLog], today: date, started_on: date
) -> int:
    target = habit.times_per_week or 0
    if target == 0:
        return 0
    streak = 0
    monday = week_start(today)
    for weeks_back in range(STREAK_LOOKBACK_DAYS // 7):
        start = monday - timedelta(weeks=weeks_back)
        if start + timedelta(days=6) < started_on:
            break
        met = sum(1 for offset in range(7) if is_met(habit, logs.get(start + timedelta(offset))))
        if met >= target:
            streak += 1
        elif weeks_back == 0:
            continue  # the current week is still in progress
        else:
            break
    return streak


def streak(
    habit: Habit, logs: Mapping[date, HabitLog], today: date, started_on: date
) -> tuple[int, Literal["days", "weeks"]]:
    if habit.cadence is Cadence.WEEKLY:
        return _weekly_streak(habit, logs, today, started_on), "weeks"
    return _daily_streak(habit, logs, today, started_on), "days"
