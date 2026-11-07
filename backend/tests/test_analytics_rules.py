from dataclasses import replace
from datetime import date

import pytest

from app.analytics.rules import EN_DASH, Facts, HabitLine, Window, label, observations, window

# Saturday 7 November 2026.
TODAY = date(2026, 11, 7)


@pytest.mark.parametrize(
    ("period", "offset", "expected"),
    [
        ("week", 0, Window(date(2026, 11, 2), date(2026, 11, 8))),
        ("week", -1, Window(date(2026, 10, 26), date(2026, 11, 1))),
        ("month", 0, Window(date(2026, 11, 1), date(2026, 11, 30))),
        ("month", -1, Window(date(2026, 10, 1), date(2026, 10, 31))),
        ("month", -11, Window(date(2025, 12, 1), date(2025, 12, 31))),
        ("month", -10, Window(date(2026, 1, 1), date(2026, 1, 31))),
    ],
)
def test_windows(period: str, offset: int, expected: Window) -> None:
    assert window(period, TODAY, offset) == expected  # type: ignore[arg-type]


def test_february_and_leap_years() -> None:
    assert window("month", date(2028, 2, 10), 0).end == date(2028, 2, 29)


def test_labels() -> None:
    assert label("week", window("week", TODAY, 0)) == f"2{EN_DASH}8 Nov 2026"
    assert label("week", window("week", TODAY, -1)) == f"26 Oct {EN_DASH} 1 Nov 2026"
    assert label("month", window("month", TODAY, 0)) == "November 2026"


BASE = Facts(
    period="week",
    is_current=True,
    completed=8,
    previous_completed=5,
    deadlines_met=3,
    deadlines_missed=1,
    overdue_now=2,
    top_area=("academics", 5),
    habits=[
        HabitLine("Read", done=7, expected=7),
        HabitLine("Gym", done=1, expected=3),
        HabitLine("Sleep", done=4, expected=6),
        HabitLine("Weigh-in", done=0, expected=1),
    ],
    inbox_open=3,
    oldest_open_days=4,
)


def test_observations_are_factual_and_ordered() -> None:
    assert observations(BASE) == [
        "Completed 8 tasks, 3 more than last week.",
        "Met 3 of 4 deadlines that fell in this week.",
        "2 tasks are overdue now.",
        "Most completed tasks were in academics (5 of 8).",
        "Gym: 1 of 3 expected.",
        "Read: done every time it was due (7 of 7).",
    ]


def test_past_windows_skip_present_tense_facts() -> None:
    lines = observations(replace(BASE, is_current=False, period="month"))
    assert lines[0] == "Completed 8 tasks, 3 more than last month."
    assert not any("overdue now" in line or "Inbox" in line for line in lines)


def test_quiet_window_says_little() -> None:
    quiet = Facts("week", True, 0, 0, 0, 0, 0, None, [], 0, None)
    assert observations(quiet) == []


def test_singulars_and_ties() -> None:
    facts = replace(
        BASE,
        completed=1,
        previous_completed=1,
        deadlines_met=0,
        deadlines_missed=0,
        overdue_now=1,
        habits=[],
        inbox_open=1,
        oldest_open_days=1,
    )
    assert observations(facts) == [
        "Completed 1 task, the same as last week.",
        "1 task is overdue now.",
        "1 capture waiting in the Inbox; the oldest is 1 day old.",
    ]


def test_no_advice_words() -> None:
    text = " ".join(observations(BASE)).lower()
    for word in ("should", "try", "great", "keep it up", "consider", "well done"):
        assert word not in text


def test_a_running_week_is_never_done_every_time() -> None:
    running = replace(BASE, habits=[HabitLine("Gym", done=2, expected=2, open=1)])
    assert not any(line.startswith("Gym") for line in observations(running))
