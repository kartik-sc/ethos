from datetime import date, time, timedelta
from decimal import Decimal

import pytest

from app.habits.models import Cadence, Habit, HabitLog, Measure
from app.habits.rules import day_state, is_met, span_hours, streak, week_progress

# Saturday 7 November 2026.
TODAY = date(2026, 11, 7)
MONDAY = date(2026, 11, 2)
EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
WEEKDAYS = [0, 1, 2, 3, 4]


def daily(weekdays: list[int] = EVERY_DAY, target: str | None = None) -> Habit:
    return Habit(
        cadence=Cadence.DAILY,
        weekdays=weekdays,
        measure=Measure.AMOUNT if target else Measure.CHECK,
        target_amount=Decimal(target) if target else None,
    )


def weekly(times: int) -> Habit:
    return Habit(cadence=Cadence.WEEKLY, times_per_week=times, measure=Measure.CHECK)


def logs(*days: date, amount: str | None = None) -> dict[date, HabitLog]:
    return {day: HabitLog(on_date=day, amount=Decimal(amount) if amount else None) for day in days}


def back(days: int) -> date:
    return TODAY - timedelta(days=days)


def test_amount_below_target_is_partial_not_met() -> None:
    habit = daily(target="120")
    assert not is_met(habit, HabitLog(amount=Decimal("90")))
    assert is_met(habit, HabitLog(amount=Decimal("120")))
    assert day_state(habit, back(1), HabitLog(amount=Decimal("90")), TODAY, back(30)) == "partial"


@pytest.mark.parametrize(
    ("day", "expected"),
    [
        (back(1), "missed"),
        (TODAY, "pending"),
        (TODAY + timedelta(days=1), "future"),
        (back(40), "inactive"),
    ],
)
def test_day_states_without_a_log(day: date, expected: str) -> None:
    assert day_state(daily(), day, None, TODAY, back(30)) == expected


def test_unscheduled_day_is_rest() -> None:
    saturday = TODAY
    assert day_state(daily(WEEKDAYS), saturday, None, TODAY, back(30)) == "rest"


def test_daily_streak_counts_back_and_today_pending_does_not_break_it() -> None:
    habit = daily()
    assert streak(habit, logs(back(1), back(2), back(3)), TODAY, back(30)) == (3, "days")
    assert streak(habit, logs(TODAY, back(1), back(2)), TODAY, back(30)) == (3, "days")


def test_daily_streak_breaks_on_a_missed_day() -> None:
    assert streak(daily(), logs(back(1), back(3)), TODAY, back(30)) == (1, "days")


def test_rest_days_do_not_break_a_weekday_streak() -> None:
    # Friday, Thursday logged; today is Saturday (rest).
    habit = daily(WEEKDAYS)
    assert streak(habit, logs(back(1), back(2)), TODAY, back(30)) == (2, "days")


def test_partial_entries_break_the_streak() -> None:
    habit = daily(target="120")
    entries = logs(back(1), amount="120") | logs(back(2), amount="60")
    assert streak(habit, entries, TODAY, back(30)) == (1, "days")


def test_streak_stops_at_the_habit_start() -> None:
    assert streak(daily(), logs(back(1), back(2)), TODAY, back(2)) == (2, "days")


def test_daily_week_progress_targets_this_weeks_scheduled_days() -> None:
    habit = daily(WEEKDAYS)
    assert week_progress(habit, logs(MONDAY, MONDAY + timedelta(1)), TODAY, back(30)) == (2, 5)


def test_week_target_ignores_days_before_the_habit_started_fri_to_sun() -> None:
    assert week_progress(daily(), {}, TODAY, started_on=TODAY - timedelta(days=1)) == (0, 3)


def test_weekly_progress_and_streak() -> None:
    habit = weekly(3)
    this_week = logs(MONDAY, MONDAY + timedelta(2))
    last_week = logs(*(MONDAY - timedelta(days=d) for d in (1, 3, 5)))
    two_weeks_ago = logs(MONDAY - timedelta(days=8))

    assert week_progress(habit, this_week, TODAY, back(60)) == (2, 3)
    # This week is still in progress, so it neither counts nor breaks the streak.
    assert streak(habit, this_week | last_week | two_weeks_ago, TODAY, back(60)) == (1, "weeks")


def test_span_hours_cross_midnight() -> None:
    assert span_hours(time(23, 30), time(7, 0)) == Decimal("7.50")
    assert span_hours(time(1, 0), time(8, 15)) == Decimal("7.25")
