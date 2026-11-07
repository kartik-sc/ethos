from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dashboard.schemas import Deadline, TaskCounts
from app.goals.models import Goal
from app.projects.models import Project
from app.tasks.models import Task, TaskStatus

RADAR_DAYS = 30


def deadlines(session: Session, today: date) -> list[Deadline]:
    """Everything due within the radar window, plus anything overdue, soonest first."""
    horizon = today + timedelta(days=RADAR_DAYS)
    items: list[Deadline] = []

    tasks = session.scalars(
        select(Task).where(
            Task.deleted_at.is_(None),
            Task.status == TaskStatus.OPEN,
            Task.due_date.is_not(None),
            Task.due_date <= horizon,
        )
    ).all()
    items += [
        Deadline(
            kind="task",
            id=task.id,
            title=task.title,
            date=task.due_date,
            days=(task.due_date - today).days,
            context=task.project.title if task.project else None,
        )
        for task in tasks
        if task.due_date is not None
    ]

    projects = session.scalars(
        select(Project).where(
            Project.deleted_at.is_(None),
            Project.due_date.is_not(None),
            Project.due_date <= horizon,
        )
    ).all()
    items += [
        Deadline(
            kind="project",
            id=project.id,
            title=project.title,
            date=project.due_date,
            days=(project.due_date - today).days,
        )
        for project in projects
        if project.due_date is not None
    ]

    goals = session.scalars(
        select(Goal).where(
            Goal.deleted_at.is_(None),
            Goal.target_date.is_not(None),
            Goal.target_date <= horizon,
        )
    ).all()
    items += [
        Deadline(
            kind="goal",
            id=goal.id,
            title=goal.title,
            date=goal.target_date,
            days=(goal.target_date - today).days,
        )
        for goal in goals
        if goal.target_date is not None
    ]

    return sorted(items, key=lambda item: (item.date, item.kind, item.title))


def task_counts(session: Session, now: datetime, timezone: str) -> TaskCounts:
    zone = ZoneInfo(timezone)
    today = now.astimezone(zone).date()
    start_of_today = datetime.combine(today, time.min, tzinfo=zone)
    start_of_week = start_of_today - timedelta(days=today.weekday())
    live = Task.deleted_at.is_(None)
    is_open = Task.status == TaskStatus.OPEN
    row = session.execute(
        select(
            func.count().filter(is_open),
            func.count().filter(is_open, Task.due_date < today),
            func.count().filter(Task.completed_at >= start_of_today),
            func.count().filter(Task.completed_at >= start_of_week),
        ).where(live)
    ).one()
    return TaskCounts(open=row[0], overdue=row[1], done_today=row[2], done_this_week=row[3])
