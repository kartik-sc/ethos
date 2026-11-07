"""Deterministic parsing of palette commands. Pure: no database, no clock, no guessing.

    /task Finish DBMS report by fri !high #academics @portfolio 45m
    /deadline Scholarship form 20 nov
    /project Portfolio site by 2026-12-31 #career
    /goal Run a 10K
    /habit leetcode 90
    /note Graph theory
    /capture call the bank about the card
    /search dbms

Anything that is not a clear command becomes an Inbox capture; nothing is invented. A date is
only set when the text names one, and an essential field that is missing produces one question.
"""

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from app.core.life_areas import LifeArea

CommandKind = Literal["task", "deadline", "project", "goal", "habit", "note", "capture", "search"]
Priority = Literal["low", "normal", "high"]

COMMANDS: dict[str, CommandKind] = {
    "task": "task",
    "t": "task",
    "deadline": "deadline",
    "d": "deadline",
    "project": "project",
    "p": "project",
    "goal": "goal",
    "g": "goal",
    "habit": "habit",
    "h": "habit",
    "note": "note",
    "n": "note",
    "capture": "capture",
    "c": "capture",
    "inbox": "capture",
    "search": "search",
    "s": "search",
}

WEEKDAYS = {
    name: index
    for index, names in enumerate(
        [
            ("mon", "monday"),
            ("tue", "tues", "tuesday"),
            ("wed", "wednesday"),
            ("thu", "thur", "thurs", "thursday"),
            ("fri", "friday"),
            ("sat", "saturday"),
            ("sun", "sunday"),
        ]
    )
    for name in names
}
MONTHS = {
    name: index + 1
    for index, names in enumerate(
        [
            ("jan", "january"),
            ("feb", "february"),
            ("mar", "march"),
            ("apr", "april"),
            ("may",),
            ("jun", "june"),
            ("jul", "july"),
            ("aug", "august"),
            ("sep", "sept", "september"),
            ("oct", "october"),
            ("nov", "november"),
            ("dec", "december"),
        ]
    )
    for name in names
}
DATE_KEYWORDS = {"by", "due", "on", "before"}
PRIORITIES: dict[str, Priority] = {
    "!high": "high",
    "!h": "high",
    "!!": "high",
    "!normal": "normal",
    "!low": "low",
    "!l": "low",
}
AREAS = {area.value: area for area in LifeArea}
DURATION = re.compile(r"^(?:(\d{1,2})h)?(?:(\d{1,3})m(?:in)?)?$")
ISO_DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
NUMERIC_DATE = re.compile(r"^(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$")
TIME_SPAN = re.compile(r"^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$")
AMOUNT = re.compile(r"^\d+(?:\.\d+)?$")


@dataclass
class Parsed:
    kind: CommandKind
    title: str = ""
    due: date | None = None
    priority: Priority | None = None
    area: LifeArea | None = None
    # `@token` naming a project; resolved against the database by the service.
    project: str | None = None
    minutes: int | None = None
    # /habit only.
    amount: str | None = None
    span: tuple[str, str] | None = None
    # The single question to ask when an essential detail is missing.
    question: str | None = None
    notes: list[str] = field(default_factory=list)


def resolve_date(words: list[str], today: date) -> date | None:
    """Reads a date from one to three words. A weekday means its next occurrence, today included."""
    text = " ".join(words).lower().strip(",.")
    if text in ("today", "tod"):
        return today
    if text in ("tomorrow", "tmr", "tmrw"):
        return today + timedelta(days=1)
    if text in WEEKDAYS:
        return today + timedelta(days=(WEEKDAYS[text] - today.weekday()) % 7)
    if len(words) == 3 and words[0].lower() == "in" and words[1].isdigit():
        count, unit = int(words[1]), words[2].lower().rstrip("s")
        if unit == "day":
            return today + timedelta(days=count)
        if unit == "week":
            return today + timedelta(weeks=count)
        return None
    if match := ISO_DATE.match(text):
        return _safe_date(int(match[1]), int(match[2]), int(match[3]))
    if match := NUMERIC_DATE.match(text):
        # Day first, as written in India.
        day, month = int(match[1]), int(match[2])
        return _with_year(day, month, int(match[3]) if match[3] else None, today)
    if len(words) in (2, 3):
        return _named_month(words, today)
    return None


def _named_month(words: list[str], today: date) -> date | None:
    lowered = [word.lower().strip(",.") for word in words]
    year = int(lowered[2]) if len(lowered) == 3 and lowered[2].isdigit() else None
    if len(lowered) == 3 and year is None:
        return None
    first, second = lowered[0], lowered[1]
    if first.isdigit() and second in MONTHS:
        return _with_year(int(first), MONTHS[second], year, today)
    if first in MONTHS and second.isdigit():
        return _with_year(int(second), MONTHS[first], year, today)
    return None


def _with_year(day: int, month: int, year: int | None, today: date) -> date | None:
    """Without a year, the next time that day comes round (this year or next)."""
    if year is not None:
        return _safe_date(year, month, day)
    candidate = _safe_date(today.year, month, day)
    if candidate is not None and candidate < today:
        candidate = _safe_date(today.year + 1, month, day)
    return candidate


def _safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _duration(token: str) -> int | None:
    match = DURATION.match(token.lower())
    if not match or not (match[1] or match[2]):
        return None
    minutes = int(match[1] or 0) * 60 + int(match[2] or 0)
    return minutes if 5 <= minutes <= 720 else None


def _take_date(words: list[str], today: date) -> tuple[date | None, list[str]]:
    """Finds `by <date>` (or due/on/before) anywhere, else a date phrase at the very end."""
    for index, word in enumerate(words):
        if word.lower() in DATE_KEYWORDS:
            for size in (3, 2, 1):
                phrase = words[index + 1 : index + 1 + size]
                if len(phrase) == size and (found := resolve_date(phrase, today)):
                    return found, words[:index] + words[index + 1 + size :]
    for size in (3, 2, 1):
        if len(words) > size and (found := resolve_date(words[-size:], today)):
            return found, words[:-size]
    return None, words


def parse(text: str, today: date) -> Parsed:
    """Parses one palette entry. Text without a known `/command` is an Inbox capture."""
    stripped = text.strip()
    head, _, rest = stripped.partition(" ")
    kind = COMMANDS.get(head[1:].lower()) if head.startswith("/") else None
    if kind is None:
        return Parsed(kind="capture", title=stripped)
    rest = rest.strip()

    if kind in ("capture", "search", "note"):
        parsed = Parsed(kind=kind, title=rest)
        if not rest:
            parsed.question = {
                "capture": "What should go in the Inbox?",
                "search": "What are you looking for?",
                "note": "What should the note be called?",
            }[kind]
        return parsed

    if kind == "habit":
        return _parse_habit(rest)

    parsed = Parsed(kind=kind)
    words: list[str] = []
    for token in rest.split():
        lowered = token.lower()
        if lowered in PRIORITIES and kind in ("task", "deadline"):
            parsed.priority = PRIORITIES[lowered]
        elif lowered.startswith("#") and lowered[1:] in AREAS:
            parsed.area = AREAS[lowered[1:]]
        elif lowered.startswith("@") and len(lowered) > 1 and kind in ("task", "deadline"):
            parsed.project = lowered[1:]
        elif kind in ("task", "deadline") and (minutes := _duration(lowered)) is not None:
            parsed.minutes = minutes
        else:
            words.append(token)

    parsed.due, words = _take_date(words, today)
    parsed.title = " ".join(words).strip()
    if not parsed.title:
        parsed.question = f"What is the {'task' if kind == 'deadline' else kind} called?"
    elif kind == "deadline" and parsed.due is None:
        parsed.question = "When is it due? Add a date, e.g. “by fri” or “20 nov”."
    if parsed.due is not None and parsed.due < today:
        parsed.notes.append("That date has already passed")
    return parsed


def _parse_habit(rest: str) -> Parsed:
    """`/habit <name> [amount | hh:mm-hh:mm]`: logs today's entry for that habit."""
    words = rest.split()
    parsed = Parsed(kind="habit")
    if words and (span := TIME_SPAN.match(words[-1])):
        parsed.span = (f"{int(span[1]):02d}:{span[2]}", f"{int(span[3]):02d}:{span[4]}")
        words = words[:-1]
    elif words and AMOUNT.match(words[-1]):
        parsed.amount = words[-1]
        words = words[:-1]
    parsed.title = " ".join(words)
    if not parsed.title:
        parsed.question = "Which habit? e.g. “/habit read 25”"
    return parsed
