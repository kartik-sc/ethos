from datetime import date

import pytest

from app.commands.parser import parse, resolve_date
from app.core.life_areas import LifeArea

# Saturday 7 November 2026.
TODAY = date(2026, 11, 7)


@pytest.mark.parametrize(
    ("words", "expected"),
    [
        ("today", date(2026, 11, 7)),
        ("tmrw", date(2026, 11, 8)),
        ("sat", date(2026, 11, 7)),
        ("fri", date(2026, 11, 13)),
        ("Monday", date(2026, 11, 9)),
        ("in 3 days", date(2026, 11, 10)),
        ("in 2 weeks", date(2026, 11, 21)),
        ("2026-12-31", date(2026, 12, 31)),
        ("20/11", date(2026, 11, 20)),
        ("5/1", date(2027, 1, 5)),
        ("20 nov", date(2026, 11, 20)),
        ("Nov 20", date(2026, 11, 20)),
        ("3 feb 2027", date(2027, 2, 3)),
        ("1 nov", date(2027, 11, 1)),
    ],
)
def test_resolve_date(words: str, expected: date) -> None:
    assert resolve_date(words.split(), TODAY) == expected


@pytest.mark.parametrize("words", ["someday", "31/2", "2026-13-01", "next week", "in 3 fortnights"])
def test_unknown_or_impossible_dates_are_not_guessed(words: str) -> None:
    assert resolve_date(words.split(), TODAY) is None


def test_task_with_every_modifier() -> None:
    parsed = parse("/task Finish DBMS report by fri !high #academics @portfolio 45m", TODAY)
    assert parsed.kind == "task"
    assert parsed.title == "Finish DBMS report"
    assert parsed.due == date(2026, 11, 13)
    assert parsed.priority == "high"
    assert parsed.area is LifeArea.ACADEMICS
    assert parsed.project == "portfolio"
    assert parsed.minutes == 45
    assert parsed.question is None


def test_trailing_date_without_a_keyword() -> None:
    parsed = parse("/t Call the bank tomorrow", TODAY)
    assert (parsed.title, parsed.due) == ("Call the bank", date(2026, 11, 8))


def test_a_task_without_a_date_gets_none_invented() -> None:
    parsed = parse("/task Read chapter 4", TODAY)
    assert (parsed.title, parsed.due, parsed.question) == ("Read chapter 4", None, None)


def test_unknown_hashtags_stay_in_the_title() -> None:
    assert parse("/task Fix #42 bug", TODAY).title == "Fix #42 bug"


def test_deadline_without_a_date_asks_one_question() -> None:
    parsed = parse("/deadline Scholarship form", TODAY)
    assert parsed.question is not None and "When is it due" in parsed.question
    assert parse("/deadline Scholarship form 20 nov", TODAY).due == date(2026, 11, 20)


def test_missing_title_asks() -> None:
    assert parse("/project", TODAY).question == "What is the project called?"
    assert parse("/task by fri", TODAY).question == "What is the task called?"


def test_past_dates_are_flagged_not_rejected() -> None:
    parsed = parse("/task Old thing by 2026-11-01", TODAY)
    assert parsed.due == date(2026, 11, 1)
    assert parsed.notes == ["That date has already passed"]


def test_project_and_goal_ignore_task_only_modifiers() -> None:
    parsed = parse("/goal Run a 10K by 2027-03-01 #health !high", TODAY)
    assert (parsed.title, parsed.area, parsed.priority) == (
        "Run a 10K !high",
        LifeArea.HEALTH,
        None,
    )


def test_habit_entries() -> None:
    leetcode = parse("/habit leetcode 90", TODAY)
    assert (leetcode.title, leetcode.amount) == ("leetcode", "90")
    sleep = parse("/h sleep 23:30-7:00", TODAY)
    assert (sleep.title, sleep.span) == ("sleep", ("23:30", "07:00"))
    gym = parse("/habit gym", TODAY)
    assert (gym.title, gym.amount, gym.span) == ("gym", None, None)


def test_plain_text_and_unknown_commands_become_captures() -> None:
    assert parse("Remind me to call Kevin", TODAY).kind == "capture"
    unknown = parse("/frobnicate things", TODAY)
    assert (unknown.kind, unknown.title) == ("capture", "/frobnicate things")


def test_note_capture_and_search_take_the_rest_verbatim() -> None:
    assert parse("/note Graph theory by fri", TODAY).title == "Graph theory by fri"
    assert parse("/search dbms !high", TODAY).title == "dbms !high"
    assert parse("/capture", TODAY).question == "What should go in the Inbox?"
