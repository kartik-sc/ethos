import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.goals.service import ensure_live_goal
from app.projects.models import Project
from app.tasks.models import NextActionOverride, Task, TaskPriority, TaskStatus
from app.tasks.schemas import TaskCreate, TaskUpdate, TaskView

DONE_VIEW_LIMIT = 100

PRIORITY_RANK = {TaskPriority.HIGH: 0, TaskPriority.NORMAL: 1, TaskPriority.LOW: 2}


class TaskNotFoundError(Exception):
    pass


class ProjectUnavailableError(Exception):
    """The referenced project does not exist or is in Trash."""


@dataclass(frozen=True)
class NextActionPick:
    task: Task
    reason: str
    overridden: bool = False


def local_today(now: datetime, timezone: str) -> date:
    return now.astimezone(ZoneInfo(timezone)).date()


def _days_until(task: Task, today: date) -> int | None:
    return None if task.due_date is None else (task.due_date - today).days


def _urgency_bucket(task: Task, today: date) -> int:
    days = _days_until(task, today)
    if days is not None and days < 0:
        return 0
    if days is not None and days <= 1:
        return 1
    if task.priority is TaskPriority.HIGH:
        return 2
    if days is not None and days <= 7:
        return 3
    return 4


def rank_key(task: Task, today: date) -> tuple[int, int, date, datetime]:
    """Overdue, then due within a day, then high priority, then due this week, then the rest."""
    return (
        _urgency_bucket(task, today),
        PRIORITY_RANK[task.priority],
        task.due_date or date.max,
        task.created_at,
    )


def describe_urgency(task: Task, today: date) -> str:
    days = _days_until(task, today)
    if days is not None and days < 0:
        return f"Overdue by {-days} day{'s' if days != -1 else ''}"
    if days == 0:
        return "Due today"
    if days == 1:
        return "Due tomorrow"
    if task.priority is TaskPriority.HIGH:
        return "High priority"
    if days is not None:
        return f"Due in {days} days"
    return "Oldest open task"


def pick_next_action(open_tasks: Sequence[Task], today: date) -> NextActionPick | None:
    if not open_tasks:
        return None
    best = min(open_tasks, key=lambda task: rank_key(task, today))
    return NextActionPick(task=best, reason=describe_urgency(best, today))


def apply_status(task: Task, status: TaskStatus, now: datetime) -> None:
    if task.status is status:
        return
    task.status = status
    task.completed_at = now if status is TaskStatus.DONE else None
    task.cancelled_at = now if status is TaskStatus.CANCELLED else None


def list_tasks(
    session: Session,
    view: TaskView,
    project_id: uuid.UUID | None = None,
    goal_id: uuid.UUID | None = None,
) -> Sequence[Task]:
    query = select(Task)
    if project_id is not None:
        query = query.where(Task.project_id == project_id)
    if goal_id is not None:
        query = query.where(Task.goal_id == goal_id)
    if view == "open":
        priority_order = case(
            (Task.priority == TaskPriority.HIGH, 0),
            (Task.priority == TaskPriority.NORMAL, 1),
            else_=2,
        )
        query = query.where(Task.deleted_at.is_(None), Task.status == TaskStatus.OPEN).order_by(
            Task.due_date.asc().nulls_last(), priority_order, Task.created_at
        )
    elif view == "done":
        closed_at = func.coalesce(Task.completed_at, Task.cancelled_at)
        query = (
            query.where(Task.deleted_at.is_(None), Task.status != TaskStatus.OPEN)
            .order_by(closed_at.desc())
            .limit(DONE_VIEW_LIMIT)
        )
    else:
        query = query.where(Task.deleted_at.is_not(None)).order_by(Task.deleted_at.desc())
    return session.scalars(query).all()


def get_task(session: Session, task_id: uuid.UUID, *, trashed: bool = False) -> Task:
    task = session.get(Task, task_id)
    if task is None or (task.deleted_at is not None) != trashed:
        raise TaskNotFoundError
    return task


def _ensure_live_project(session: Session, project_id: uuid.UUID | None) -> None:
    if project_id is None:
        return
    project = session.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise ProjectUnavailableError


def create_task(session: Session, data: TaskCreate) -> Task:
    _ensure_live_project(session, data.project_id)
    ensure_live_goal(session, data.goal_id)
    task = Task(**data.model_dump())
    session.add(task)
    session.commit()
    return task


def update_task(session: Session, task: Task, changes: TaskUpdate, now: datetime) -> Task:
    fields = changes.model_dump(exclude_unset=True)
    status = fields.pop("status", None)
    if "project_id" in fields:
        _ensure_live_project(session, fields["project_id"])
    if "goal_id" in fields:
        ensure_live_goal(session, fields["goal_id"])
    for name, value in fields.items():
        setattr(task, name, value)
    if status is not None:
        apply_status(task, status, now)
    session.commit()
    session.refresh(task)  # reload project/goal relationships if a link changed
    return task


def trash_task(session: Session, task: Task, now: datetime) -> None:
    task.deleted_at = now
    session.commit()


def restore_task(session: Session, task: Task) -> Task:
    if task.project is not None and task.project.deleted_at is not None:
        raise ProjectUnavailableError
    task.deleted_at = None
    session.commit()
    return task


def _open_tasks(session: Session) -> Sequence[Task]:
    return session.scalars(
        select(Task).where(Task.deleted_at.is_(None), Task.status == TaskStatus.OPEN)
    ).all()


def current_next_action(session: Session, now: datetime, timezone: str) -> NextActionPick | None:
    """Today's override wins while its task is still open; otherwise the ranked pick."""
    open_tasks = _open_tasks(session)
    today = local_today(now, timezone)
    start_of_day = datetime.combine(today, time.min, tzinfo=ZoneInfo(timezone))

    chosen_id = session.scalar(
        select(NextActionOverride.chosen_task_id)
        .where(NextActionOverride.created_at >= start_of_day)
        .order_by(NextActionOverride.created_at.desc())
        .limit(1)
    )
    chosen = next((task for task in open_tasks if task.id == chosen_id), None)
    if chosen is not None:
        return NextActionPick(task=chosen, reason="Your pick for today", overridden=True)
    return pick_next_action(open_tasks, today)


def record_override(
    session: Session, suggested_task_id: uuid.UUID | None, chosen_task_id: uuid.UUID
) -> None:
    chosen = get_task(session, chosen_task_id)
    if chosen.status is not TaskStatus.OPEN:
        raise TaskNotFoundError
    if suggested_task_id is not None and session.get(Task, suggested_task_id) is None:
        raise TaskNotFoundError
    session.add(NextActionOverride(suggested_task_id=suggested_task_id, chosen_task_id=chosen.id))
    session.commit()
