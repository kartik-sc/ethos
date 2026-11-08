from datetime import date, datetime, time, timedelta
from itertools import pairwise
from zoneinfo import ZoneInfo

from app.calendar.slots import (
    DayWindow,
    Interval,
    Request,
    find_slot,
    first_fit,
    free_intervals,
    plan,
)

IST = ZoneInfo("Asia/Kolkata")
MON = date(2026, 11, 9)
WINDOW = DayWindow(time(8, 0), time(22, 0), "Asia/Kolkata")


def at(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), IST)


def span(day: date, start: tuple[int, int], end: tuple[int, int]) -> Interval:
    return Interval(at(day, *start), at(day, *end))


def test_free_intervals_skip_busy_and_overlaps() -> None:
    busy = [span(MON, (9, 0), (10, 0)), span(MON, (9, 30), (11, 0)), span(MON, (21, 0), (23, 0))]
    free = free_intervals(WINDOW.on(MON), busy, at(MON, 0))
    assert free == [span(MON, (8, 0), (9, 0)), span(MON, (11, 0), (21, 0))]


def test_free_intervals_start_from_now() -> None:
    free = free_intervals(WINDOW.on(MON), [], at(MON, 15, 10))
    assert free == [span(MON, (15, 10), (22, 0))]


def test_busy_day_has_no_free_time() -> None:
    assert free_intervals(WINDOW.on(MON), [span(MON, (7, 0), (23, 0))], at(MON, 0)) == []


def test_first_fit_needs_a_long_enough_gap() -> None:
    gaps = [span(MON, (8, 0), (8, 45)), span(MON, (12, 0), (14, 0))]
    assert first_fit(gaps, 60) == span(MON, (12, 0), (13, 0))
    assert first_fit(gaps, 121) is None


def test_slot_starts_on_a_quarter_hour() -> None:
    slot = find_slot([MON], WINDOW, [], 30, at(MON, 10, 7))
    assert slot == span(MON, (10, 15), (10, 45))


def test_slot_rolls_to_the_next_day_when_today_is_full() -> None:
    tue = MON + timedelta(days=1)
    slot = find_slot([MON, tue], WINDOW, [], 60, at(MON, 21, 30))
    assert slot == span(tue, (8, 0), (9, 0))


def test_window_keeps_local_clock_time_across_dst() -> None:
    london = DayWindow(time(9, 0), time(17, 0), "Europe/London")
    before = london.on(date(2026, 10, 24)).start
    after = london.on(date(2026, 10, 26)).start
    assert (before.hour, after.hour) == (9, 9)
    assert before.utcoffset() != after.utcoffset()


def test_plan_respects_order_deadlines_and_reports_overload() -> None:
    tue = MON + timedelta(days=1)
    fixed = [span(MON, (8, 0), (20, 0)), span(tue, (8, 0), (21, 0))]
    requests = [
        Request("urgent", 120, MON),  # only 2h free on Monday
        Request("also-monday", 60, MON),  # Monday is now full
        Request("later", 60, None),
    ]
    placed, unplaced = plan(requests, MON, 3, WINDOW, fixed, at(MON, 7))

    assert [(p.key, p.slot) for p in placed] == [
        ("urgent", span(MON, (20, 0), (22, 0))),
        ("later", span(tue, (21, 0), (22, 0))),
    ]
    assert [(u.key, u.reason) for u in unplaced] == [
        ("also-monday", "no free slot before the deadline")
    ]


def test_plan_never_overlaps_existing_or_new_blocks() -> None:
    requests = [Request(str(i), 90, None) for i in range(5)]
    busy = [span(MON, (10, 0), (11, 0))]
    placed, unplaced = plan(requests, MON, 1, WINDOW, busy, at(MON, 7))
    slots = sorted([*busy, *(p.slot for p in placed)])
    assert all(a.end <= b.start for a, b in pairwise(slots))
    assert len(placed) == 5 and unplaced == []


def test_plan_rejects_past_deadlines_and_oversized_work() -> None:
    requests = [Request("late", 30, MON - timedelta(days=1)), Request("huge", 15 * 60, None)]
    _, unplaced = plan(requests, MON, 7, WINDOW, [], at(MON, 7))
    assert [(u.key, u.reason) for u in unplaced] == [
        ("late", "deadline has passed"),
        ("huge", "longer than the working day"),
    ]
