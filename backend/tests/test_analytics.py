from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.analytics.rules import EN_DASH, Window
from app.analytics.service import habit_adherence, report
from app.core.life_areas import LifeArea
from app.habits.models import Cadence, Habit, HabitLog, Measure
from app.inbox.models import InboxItem
from app.tasks.models import Task, TaskStatus

ZONE = ZoneInfo("Asia/Kolkata")
# Wednesday 11 November 2026, noon in Kolkata. The week runs 9 to 15 Nov.
NOW = datetime(2026, 11, 11, 12, tzinfo=ZONE)
TODAY = date(2026, 11, 11)
WEEK = Window(date(2026, 11, 9), date(2026, 11, 15))


def at(day: date, hour: int = 10) -> datetime:
    return datetime(day.year, day.month, day.day, hour, tzinfo=ZONE).astimezone(UTC)


def task(session: Session, title: str, **fields: object) -> Task:
    record = Task(title=title, created_at=at(date(2026, 11, 1)), **fields)
    session.add(record)
    session.commit()
    return record


def done(day: date, **fields: object) -> dict[str, object]:
    return {"status": TaskStatus.DONE, "completed_at": at(day), **fields}


def test_completions_by_day_area_and_against_last_week(session: Session) -> None:
    task(session, "a", **done(date(2026, 11, 9), area=LifeArea.ACADEMICS))
    task(session, "b", **done(date(2026, 11, 10), area=LifeArea.ACADEMICS))
    task(session, "c", **done(date(2026, 11, 10), area=LifeArea.CAREER))
    task(session, "last week", **done(date(2026, 11, 4)))
    task(session, "gone", **done(date(2026, 11, 10)), deleted_at=at(date(2026, 11, 10)))

    result = report(session, "week", 0, NOW, "Asia/Kolkata")

    assert (result.start, result.end, result.label) == (
        WEEK.start,
        WEEK.end,
        f"9{EN_DASH}15 Nov 2026",
    )
    assert result.totals.completed == 3
    assert result.previous.completed == 1
    assert [(day.date.day, day.count) for day in result.completed_by_day][:3] == [
        (9, 1),
        (10, 2),
        (11, 0),
    ]
    assert len(result.completed_by_day) == 7
    assert [(row.area, row.count) for row in result.completed_by_area] == [
        (LifeArea.ACADEMICS, 2),
        (LifeArea.CAREER, 1),
    ]
    assert result.observations[0] == "Completed 3 tasks, 2 more than last week."
    assert "Most completed tasks were in academics (2 of 3)." in result.observations


def test_late_evening_completions_count_on_the_local_day(session: Session) -> None:
    # 23:30 in Kolkata on Sunday 8 Nov is still last week, though it is 18:00 UTC.
    late = datetime(2026, 11, 8, 23, 30, tzinfo=ZONE)
    task(session, "late", status=TaskStatus.DONE, completed_at=late)
    result = report(session, "week", 0, NOW, "Asia/Kolkata")
    assert (result.totals.completed, result.previous.completed) == (0, 1)


def test_deadlines_met_missed_and_not_yet_due(session: Session) -> None:
    task(session, "met", due_date=date(2026, 11, 10), **done(date(2026, 11, 10)))
    task(session, "late", due_date=date(2026, 11, 9), **done(date(2026, 11, 10)))
    task(session, "open past", due_date=date(2026, 11, 10))
    task(session, "open future", due_date=date(2026, 11, 13))
    task(
        session,
        "cancelled",
        due_date=date(2026, 11, 9),
        status=TaskStatus.CANCELLED,
        cancelled_at=at(date(2026, 11, 9)),
    )

    result = report(session, "week", 0, NOW, "Asia/Kolkata")

    assert (result.totals.deadlines_met, result.totals.deadlines_missed) == (1, 2)
    assert result.totals.cancelled == 1
    assert result.overdue_now == 1


def daily(weekdays: list[int], target: str | None = None) -> Habit:
    return Habit(
        title="Read",
        cadence=Cadence.DAILY,
        weekdays=weekdays,
        measure=Measure.CHECK if target is None else Measure.AMOUNT,
        target_amount=None if target is None else target,
    )


def logged(*days: date) -> dict[date, HabitLog]:
    return {day: HabitLog(on_date=day) for day in days}


def test_daily_adherence_counts_today_only_once_done() -> None:
    habit = daily([0, 1, 2, 3, 4, 5, 6])
    mon, tue, wed = date(2026, 11, 9), date(2026, 11, 10), TODAY
    start = date(2026, 1, 1)
    assert habit_adherence(habit, logged(mon), WEEK, TODAY, start) == (1, 2)
    assert habit_adherence(habit, logged(mon, tue, wed), WEEK, TODAY, start) == (3, 3)


def test_daily_adherence_ignores_rest_days_and_days_before_the_habit() -> None:
    weekdays_only = daily([0, 1, 2, 3, 4])
    assert habit_adherence(weekdays_only, {}, WEEK, date(2026, 11, 16), date(2026, 1, 1)) == (0, 5)
    assert habit_adherence(daily([0, 1, 2, 3, 4, 5, 6]), {}, WEEK, TODAY, TODAY) == (0, 0)


def test_weekly_adherence_caps_at_target_and_spares_the_running_week() -> None:
    gym = Habit(title="Gym", cadence=Cadence.WEEKLY, times_per_week=3, measure=Measure.CHECK)
    month = Window(date(2026, 10, 1), date(2026, 10, 31))
    # Weeks starting 5, 12, 19, 26 Oct; the last runs into November but belongs to October.
    entries = logged(
        *(date(2026, 10, d) for d in (5, 6, 7, 8)),  # 4 entries, capped at 3
        date(2026, 10, 13),
        *(date(2026, 10, d) for d in (26, 27)),
    )
    assert habit_adherence(gym, entries, month, date(2026, 11, 11), date(2026, 1, 1)) == (6, 12)

    running = habit_adherence(gym, logged(date(2026, 11, 9)), WEEK, TODAY, date(2026, 1, 1))
    assert running == (1, 1)


def test_inbox_numbers(session: Session) -> None:
    session.add_all(
        [
            InboxItem(
                content="a",
                created_at=at(date(2026, 11, 9), 9),
                processed_at=at(date(2026, 11, 9), 13),
            ),
            InboxItem(content="b", created_at=at(date(2026, 11, 10), 9)),
            InboxItem(
                content="c",
                created_at=at(date(2026, 11, 2), 9),
                processed_at=at(date(2026, 11, 10), 9),
            ),
        ]
    )
    session.commit()

    result = report(session, "week", 0, NOW, "Asia/Kolkata")

    assert (result.totals.captured, result.totals.processed) == (2, 2)
    assert result.inbox_median_hours == 98.0
    assert result.inbox_open == 1
    assert "1 capture waiting in the Inbox; the oldest is 1 day old." in result.observations


def test_month_report_and_past_windows(session: Session) -> None:
    task(session, "october", **done(date(2026, 10, 20)))
    result = report(session, "month", -1, NOW, "Asia/Kolkata")
    assert (result.label, result.is_current, result.totals.completed) == ("October 2026", False, 1)
    assert len(result.completed_by_day) == 31


def test_api_shape_and_limits(client: TestClient) -> None:
    body = client.get("/api/v1/analytics", params={"period": "month"}).json()
    assert body["period"] == "month"
    assert body["observations"] == []
    assert client.get("/api/v1/analytics", params={"offset": 1}).status_code == 422
    assert (
        client.get("/api/v1/analytics", params={"period": "month", "offset": -30}).status_code
        == 422
    )
    assert client.get("/api/v1/analytics", params={"period": "day"}).status_code == 422


def test_week_window_is_monday_first() -> None:
    assert WEEK.start.weekday() == 0 and len(WEEK.days) == 7
    assert WEEK.days[-1] - WEEK.days[0] == timedelta(days=6)
