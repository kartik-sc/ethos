import pytest

from app.notes.models import LinkKind
from app.notes.text import normalize_tag, normalize_tags, parse_links, split_label


def test_parse_links_in_order_without_duplicates() -> None:
    content = "See [[Graph theory]] and [[task:Revise OS]].\nAgain [[Graph theory]] and [[ ]]."
    assert parse_links(content) == ["Graph theory", "task:Revise OS"]


def test_alias_keeps_the_target_title() -> None:
    assert parse_links("[[Graph theory|graphs]]") == ["Graph theory"]


def test_links_do_not_span_lines_or_nest() -> None:
    assert parse_links("[[broken\nlink]] [[a [[b]]") == ["b"]


@pytest.mark.parametrize(
    ("label", "expected"),
    [
        ("Graph theory", (LinkKind.NOTE, "Graph theory")),
        ("task:Revise OS", (LinkKind.TASK, "Revise OS")),
        ("Project: Portfolio", (LinkKind.PROJECT, "Portfolio")),
        ("goal:", (LinkKind.NOTE, "goal:")),
        ("Taskmaster notes", (LinkKind.NOTE, "Taskmaster notes")),
    ],
)
def test_split_label(label: str, expected: tuple[LinkKind, str]) -> None:
    assert split_label(label) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("#DBMS", "dbms"),
        ("  machine learning ", "machine-learning"),
        ("cs/algorithms", "cs/algorithms"),
        ("emoji 🚀 ok", "emoji--ok"),
        ("###", None),
    ],
)
def test_normalize_tag(raw: str, expected: str | None) -> None:
    assert normalize_tag(raw) == expected


def test_normalize_tags_dedupes_and_sorts() -> None:
    assert normalize_tags(["b", "#A", "a", ""]) == ["a", "b"]
