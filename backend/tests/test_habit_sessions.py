from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.calendar import habit_sessions, slots
from app.calendar.models import BlockKind, BlockStatus, CalendarBlock
from app.calendar.service import Context
from app.habits.models import Habit, HabitLog
from app.habits.schemas import HabitCreate

IST = ZoneInfo("Asia/Kolkata")
MONDAY = date(2030, 1, 7)


def at(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), IST)


def context(moment: datetime) -> Context:
    return Context(
        now=moment,
        timezone="Asia/Kolkata",
        window=slots.DayWindow(time(8, 0), time(22, 0), "Asia/Kolkata"),
        default_minutes=60,
    )


def habit(session: Session, title: str, **fields: Any) -> Habit:
    """Inserted directly: the API would also book sessions at the real current time."""
    data = HabitCreate.model_validate(
        {"title": title, "cadence": "daily", "weekdays": list(range(7)), **fields}
    )
    created = Habit(**data.model_dump())
    session.add(created)
    session.commit()
    return created


def sessions(session: Session, habit_id: Any) -> list[tuple[datetime, datetime, BlockStatus]]:
    session.expire_all()
    blocks = session.scalars(
        select(CalendarBlock)
        .where(CalendarBlock.habit_id == habit_id)
        .order_by(CalendarBlock.starts_at)
    ).all()
    return [(b.starts_at.astimezone(IST), b.ends_at.astimezone(IST), b.status) for b in blocks]


def event(session: Session, start: datetime, end: datetime) -> None:
    session.add(
        CalendarBlock(kind=BlockKind.EVENT, title="Fixed", starts_at=start, ends_at=end, fixed=True)
    )
    session.commit()


def log(session: Session, habit_id: Any, day: date) -> None:
    session.add(HabitLog(habit_id=habit_id, on_date=day))
    session.commit()


SCHEDULED, DONE, MISSED = BlockStatus.SCHEDULED, BlockStatus.DONE, BlockStatus.MISSED


def test_daily_session_books_the_preferred_time_each_day(
    client: TestClient, session: Session
) -> None:
    run = habit(session, "Run", session_minutes=45, session_time="07:00")
    habit_sessions.refresh(session, context(at(MONDAY, 6)), MONDAY + timedelta(days=1))

    tuesday = MONDAY + timedelta(days=1)
    assert sessions(session, run.id) == [
        (at(MONDAY, 7), at(MONDAY, 7, 45), SCHEDULED),
        (at(tuesday, 7), at(tuesday, 7, 45), SCHEDULED),
    ]
    habit_sessions.refresh(session, context(at(MONDAY, 6)), tuesday)
    assert len(sessions(session, run.id)) == 2, "refresh is idempotent"


def test_busy_or_passed_preferred_time_falls_back_to_free_time(
    client: TestClient, session: Session
) -> None:
    event(session, at(MONDAY, 8), at(MONDAY, 12))
    read = habit(session, "Read", session_minutes=30, session_time="09:00")
    habit_sessions.refresh(session, context(at(MONDAY, 6)))
    assert sessions(session, read.id)[0][0] == at(MONDAY, 12)

    late = habit(session, "Stretch", session_minutes=15, session_time="07:00")
    habit_sessions.refresh(session, context(at(MONDAY, 13, 5)))
    assert sessions(session, late.id)[0][0] == at(MONDAY, 13, 15)


def test_missed_protected_session_recovers_later_the_same_day_at_full_length(
    client: TestClient, session: Session
) -> None:
    leetcode = habit(session, "LeetCode", protected=True, session_minutes=120, session_time="09:00")
    habit_sessions.refresh(session, context(at(MONDAY, 8)))
    event(session, at(MONDAY, 11), at(MONDAY, 14))

    report = habit_sessions.refresh(session, context(at(MONDAY, 11, 30)))

    assert (report.missed, report.recovered) == (1, 1)
    assert sessions(session, leetcode.id) == [
        (at(MONDAY, 9), at(MONDAY, 11), MISSED),
        (at(MONDAY, 14), at(MONDAY, 16), SCHEDULED),
    ]
    recovery = session.scalars(
        select(CalendarBlock).where(CalendarBlock.recovers_id.is_not(None))
    ).one()
    assert recovery.fixed


def test_unrecoverable_protected_session_is_surfaced_not_moved_to_tomorrow(
    client: TestClient, session: Session
) -> None:
    leetcode = habit(session, "LeetCode", protected=True, session_minutes=120, session_time="09:00")
    habit_sessions.refresh(session, context(at(MONDAY, 8)))
    event(session, at(MONDAY, 11), at(MONDAY, 21))

    report = habit_sessions.refresh(session, context(at(MONDAY, 11, 5)))

    assert report.recovered == 0
    assert sessions(session, leetcode.id) == [(at(MONDAY, 9), at(MONDAY, 11), MISSED)]
    [unbooked] = habit_sessions.unbooked_today(session, context(at(MONDAY, 11, 5)))
    assert (unbooked.title, unbooked.minutes) == ("LeetCode", 120)


def test_ordinary_missed_session_just_stays_missed(client: TestClient, session: Session) -> None:
    read = habit(session, "Read", session_minutes=30, session_time="09:00")
    habit_sessions.refresh(session, context(at(MONDAY, 8)))

    report = habit_sessions.refresh(session, context(at(MONDAY, 10)))

    assert (report.missed, report.recovered) == (1, 0)
    assert sessions(session, read.id) == [(at(MONDAY, 9), at(MONDAY, 9, 30), MISSED)]
    assert habit_sessions.unbooked_today(session, context(at(MONDAY, 10))) == []


def test_logging_the_habit_marks_its_session_done(client: TestClient, session: Session) -> None:
    leetcode = habit(session, "LeetCode", protected=True, session_minutes=120, session_time="18:00")
    habit_sessions.refresh(session, context(at(MONDAY, 8)))
    log(session, leetcode.id, MONDAY)

    habit_sessions.refresh(session, context(at(MONDAY, 12)))

    assert sessions(session, leetcode.id)[0][2] is DONE


def test_weekly_sessions_spread_over_the_week(client: TestClient, session: Session) -> None:
    gym = habit(session, "Gym", cadence="weekly", times_per_week=3, session_minutes=60)
    habit_sessions.refresh(session, context(at(MONDAY, 7)))

    days = [start.date() for start, _, _ in sessions(session, gym.id)]
    assert days == [MONDAY, MONDAY + timedelta(days=2), MONDAY + timedelta(days=4)]


def test_missed_weekly_session_is_redistributed_over_the_rest_of_the_week(
    client: TestClient, session: Session
) -> None:
    gym = habit(session, "Gym", cadence="weekly", times_per_week=3, session_minutes=60)
    habit_sessions.refresh(session, context(at(MONDAY, 7)))
    log(session, gym.id, MONDAY)
    thursday = MONDAY + timedelta(days=3)

    report = habit_sessions.refresh(session, context(at(thursday, 9)))

    assert report.missed == 1, "Wednesday's session passed without an entry"
    statuses = {start.date(): status for start, _, status in sessions(session, gym.id)}
    assert statuses == {
        MONDAY: DONE,
        MONDAY + timedelta(days=2): MISSED,
        thursday: SCHEDULED,
        MONDAY + timedelta(days=4): SCHEDULED,
    }


def test_weekly_shortfall_is_reported_when_the_week_is_full(
    client: TestClient, session: Session
) -> None:
    saturday = MONDAY + timedelta(days=5)
    for offset in range(2):
        day = saturday + timedelta(days=offset)
        event(session, at(day, 8), at(day, 22))
    gym = habit(session, "Gym", cadence="weekly", times_per_week=3, session_minutes=60)

    report = habit_sessions.refresh(session, context(at(saturday, 7)))

    assert sessions(session, gym.id) == []
    assert [item.title for item in report.unbooked] == ["Gym"] * 3


def test_removed_session_is_not_booked_again_and_protected_ones_stay(
    client: TestClient, session: Session
) -> None:
    read = habit(session, "Read", session_minutes=30, session_time="20:00")
    leetcode = habit(session, "LeetCode", protected=True, session_minutes=120, session_time="09:00")
    habit_sessions.refresh(session, context(at(MONDAY, 8)))
    read_block = session.scalars(
        select(CalendarBlock).where(CalendarBlock.habit_id == read.id)
    ).one()
    protected_block = session.scalars(
        select(CalendarBlock).where(CalendarBlock.habit_id == leetcode.id)
    ).one()

    assert client.delete(f"/api/v1/calendar/blocks/{protected_block.id}").status_code == 409
    assert client.delete(f"/api/v1/calendar/blocks/{read_block.id}").status_code == 204
    habit_sessions.refresh(session, context(at(MONDAY, 8)))

    assert [status for *_, status in sessions(session, read.id)] == [BlockStatus.CANCELLED]
    assert habit_sessions.unbooked_today(session, context(at(MONDAY, 8))) == []


def test_releasing_future_sessions_rebooks_them_at_the_same_local_time(
    client: TestClient, session: Session
) -> None:
    run = habit(session, "Run", session_minutes=45, session_time="07:00")
    habit_sessions.refresh(session, context(at(MONDAY, 6)))
    london = Context(
        now=at(MONDAY, 6),
        timezone="Europe/London",
        window=slots.DayWindow(time(6, 0), time(22, 0), "Europe/London"),
        default_minutes=60,
    )

    habit_sessions.release_future(session, london.now)
    habit_sessions.refresh(session, london)

    [(start, _, _)] = sessions(session, run.id)
    local = start.astimezone(ZoneInfo("Europe/London"))
    assert (local.date(), local.time()) == (MONDAY, time(7, 0))


def test_concurrent_refreshes_never_double_book(client: TestClient, session: Session) -> None:
    import threading

    from app.core.db import get_sessionmaker

    leetcode = habit(session, "LeetCode", protected=True, session_minutes=120)
    gym = habit(session, "Gym", cadence="weekly", times_per_week=3, session_minutes=60)
    barrier = threading.Barrier(4)
    errors: list[BaseException] = []

    def worker() -> None:
        try:
            with get_sessionmaker()() as own:
                barrier.wait()
                habit_sessions.refresh(own, context(at(MONDAY, 7)), MONDAY + timedelta(days=1))
        except BaseException as error:  # pragma: no cover - surfaced below
            errors.append(error)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert len(sessions(session, leetcode.id)) == 2, "today and tomorrow, once each"
    assert len(sessions(session, gym.id)) == 3


def test_recovery_is_retried_when_time_frees_up_later(client: TestClient, session: Session) -> None:
    leetcode = habit(session, "LeetCode", protected=True, session_minutes=120, session_time="09:00")
    habit_sessions.refresh(session, context(at(MONDAY, 8)))
    event(session, at(MONDAY, 11), at(MONDAY, 22))
    first = habit_sessions.refresh(session, context(at(MONDAY, 11, 5)))
    assert first.recovered == 0 and len(first.unbooked) == 1

    blocker = session.scalars(select(CalendarBlock).where(CalendarBlock.kind == BlockKind.EVENT))
    blocker.one().ends_at = at(MONDAY, 15)
    session.commit()
    second = habit_sessions.refresh(session, context(at(MONDAY, 12)))

    assert second.recovered == 1
    assert sessions(session, leetcode.id)[-1][:2] == (at(MONDAY, 15), at(MONDAY, 17))
    third = habit_sessions.refresh(session, context(at(MONDAY, 12, 30)))
    assert third.recovered == 0, "one recovery at a time"


def test_missed_recovery_from_yesterday_is_never_carried_over(
    client: TestClient, session: Session
) -> None:
    leetcode = habit(session, "LeetCode", protected=True, session_minutes=120, session_time="09:00")
    habit_sessions.refresh(session, context(at(MONDAY, 8)))
    tuesday = MONDAY + timedelta(days=1)

    report = habit_sessions.refresh(session, context(at(tuesday, 6)))

    assert report.missed == 1 and report.recovered == 0
    days = [(start.date(), status) for start, _, status in sessions(session, leetcode.id)]
    assert days == [(MONDAY, MISSED), (tuesday, SCHEDULED)]
    assert days.count((tuesday, SCHEDULED)) == 1


def test_weekly_target_met_early_releases_later_sessions(
    client: TestClient, session: Session
) -> None:
    gym = habit(session, "Gym", cadence="weekly", times_per_week=2, session_minutes=60)
    habit_sessions.refresh(session, context(at(MONDAY, 7)))
    assert len(sessions(session, gym.id)) == 2
    tuesday = MONDAY + timedelta(days=1)
    log(session, gym.id, MONDAY)
    log(session, gym.id, tuesday)

    habit_sessions.refresh(session, context(at(tuesday, 20)))

    statuses = [status for *_, status in sessions(session, gym.id)]
    assert statuses == [DONE], "the later session gave its time back"


def test_worker_jobs_survive_unexpected_errors(monkeypatch: Any, session: Session) -> None:
    from app.worker import main as worker

    def explode(*_args: Any, **_kwargs: Any) -> None:
        raise ValueError("boom")

    monkeypatch.setattr(habit_sessions, "refresh", explode)
    monkeypatch.setattr(worker, "purge_expired", explode)
    worker.refresh_habit_sessions()
    worker.purge_trash()
