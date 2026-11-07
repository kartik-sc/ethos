from datetime import UTC, date, datetime, timedelta

import pytest

from app.tasks.models import Task, TaskPriority, TaskStatus
from app.tasks.service import apply_status, describe_urgency, local_today, pick_next_action

TODAY = date(2026, 11, 7)
EPOCH = datetime(2026, 11, 1, tzinfo=UTC)


def make_task(
    title: str,
    *,
    due_in: int | None = None,
    priority: TaskPriority = TaskPriority.NORMAL,
    created_minute: int = 0,
) -> Task:
    return Task(
        title=title,
        priority=priority,
        status=TaskStatus.OPEN,
        due_date=None if due_in is None else TODAY + timedelta(days=due_in),
        created_at=EPOCH + timedelta(minutes=created_minute),
    )


def test_no_open_tasks_means_no_next_action() -> None:
    assert pick_next_action([], TODAY) is None


def test_overdue_beats_everything() -> None:
    tasks = [
        make_task("high, due tomorrow", due_in=1, priority=TaskPriority.HIGH),
        make_task("low, overdue", due_in=-1, priority=TaskPriority.LOW),
    ]
    pick = pick_next_action(tasks, TODAY)
    assert pick is not None
    assert pick.task.title == "low, overdue"
    assert pick.reason == "Overdue by 1 day"


def test_due_within_a_day_beats_undated_high_priority() -> None:
    tasks = [
        make_task("high, undated", priority=TaskPriority.HIGH),
        make_task("normal, due tomorrow", due_in=1),
    ]
    pick = pick_next_action(tasks, TODAY)
    assert pick is not None
    assert pick.task.title == "normal, due tomorrow"


def test_high_priority_beats_due_this_week() -> None:
    tasks = [
        make_task("normal, due in 3 days", due_in=3),
        make_task("high, undated", priority=TaskPriority.HIGH),
    ]
    pick = pick_next_action(tasks, TODAY)
    assert pick is not None
    assert pick.task.title == "high, undated"
    assert pick.reason == "High priority"


def test_ties_fall_back_to_oldest() -> None:
    tasks = [make_task("newer", created_minute=5), make_task("older", created_minute=1)]
    pick = pick_next_action(tasks, TODAY)
    assert pick is not None
    assert pick.task.title == "older"
    assert pick.reason == "Oldest open task"


@pytest.mark.parametrize(
    ("due_in", "expected"),
    [(-3, "Overdue by 3 days"), (0, "Due today"), (1, "Due tomorrow"), (5, "Due in 5 days")],
)
def test_urgency_wording(due_in: int, expected: str) -> None:
    assert describe_urgency(make_task("t", due_in=due_in), TODAY) == expected


def test_status_changes_stamp_and_clear_timestamps() -> None:
    task = make_task("t")
    now = datetime(2026, 11, 7, 9, tzinfo=UTC)

    apply_status(task, TaskStatus.DONE, now)
    assert (task.completed_at, task.cancelled_at) == (now, None)

    apply_status(task, TaskStatus.CANCELLED, now)
    assert (task.completed_at, task.cancelled_at) == (None, now)

    apply_status(task, TaskStatus.OPEN, now)
    assert (task.completed_at, task.cancelled_at) == (None, None)


def test_repeating_a_status_keeps_the_original_timestamp() -> None:
    task = make_task("t")
    first = datetime(2026, 11, 7, 9, tzinfo=UTC)
    apply_status(task, TaskStatus.DONE, first)
    apply_status(task, TaskStatus.DONE, first + timedelta(hours=1))
    assert task.completed_at == first


def test_local_today_uses_the_owner_timezone() -> None:
    late_utc = datetime(2026, 11, 7, 20, tzinfo=UTC)  # 01:30 on the 8th in Kolkata
    assert local_today(late_utc, "Asia/Kolkata") == date(2026, 11, 8)
