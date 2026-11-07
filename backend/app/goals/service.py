import uuid
from collections.abc import Iterable, Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.goals.models import Goal
from app.goals.schemas import GoalCreate, GoalProgress, GoalUpdate, GoalView
from app.habits.models import Habit
from app.projects.models import Project
from app.tasks.models import Task, TaskStatus


class GoalNotFoundError(Exception):
    pass


class GoalUnavailableError(Exception):
    """A record tried to link to a goal that does not exist or is in Trash."""


def ensure_live_goal(session: Session, goal_id: uuid.UUID | None) -> None:
    if goal_id is None:
        return
    goal = session.get(Goal, goal_id)
    if goal is None or goal.deleted_at is not None:
        raise GoalUnavailableError


def list_goals(session: Session, view: GoalView) -> Sequence[Goal]:
    query = select(Goal)
    if view == "active":
        query = query.where(Goal.deleted_at.is_(None)).order_by(
            Goal.target_date.asc().nulls_last(), Goal.created_at.desc()
        )
    else:
        query = query.where(Goal.deleted_at.is_not(None)).order_by(Goal.deleted_at.desc())
    return session.scalars(query).all()


def progress(session: Session, goal_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, GoalProgress]:
    """A task counts toward its own goal, or failing that, its project's goal: never both."""
    ids = list(goal_ids)
    if not ids:
        return {}

    effective_goal = func.coalesce(Task.goal_id, Project.goal_id)
    task_rows = session.execute(
        select(
            effective_goal,
            func.count().filter(Task.status == TaskStatus.DONE),
            func.count(),
        )
        .select_from(Task)
        .outerjoin(Project, Task.project_id == Project.id)
        .where(
            effective_goal.in_(ids),
            Task.deleted_at.is_(None),
            Task.status != TaskStatus.CANCELLED,
        )
        .group_by(effective_goal)
    ).all()
    project_rows = session.execute(
        select(Project.goal_id, func.count())
        .where(Project.goal_id.in_(ids), Project.deleted_at.is_(None))
        .group_by(Project.goal_id)
    ).all()

    habit_rows = session.execute(
        select(Habit.goal_id, func.count())
        .where(Habit.goal_id.in_(ids), Habit.deleted_at.is_(None))
        .group_by(Habit.goal_id)
    ).all()

    result = {goal_id: GoalProgress() for goal_id in ids}
    for goal_id, done, total in task_rows:
        result[goal_id].done, result[goal_id].total = done, total
    for project_goal_id, count in project_rows:
        if project_goal_id is not None:
            result[project_goal_id].projects = count
    for habit_goal_id, count in habit_rows:
        if habit_goal_id is not None:
            result[habit_goal_id].habits = count
    return result


def get_goal(session: Session, goal_id: uuid.UUID, *, trashed: bool = False) -> Goal:
    goal = session.get(Goal, goal_id)
    if goal is None or (goal.deleted_at is not None) != trashed:
        raise GoalNotFoundError
    return goal


def create_goal(session: Session, data: GoalCreate) -> Goal:
    goal = Goal(**data.model_dump())
    session.add(goal)
    session.commit()
    return goal


def update_goal(session: Session, goal: Goal, changes: GoalUpdate) -> Goal:
    for name, value in changes.model_dump(exclude_unset=True).items():
        setattr(goal, name, value)
    session.commit()
    return goal


def trash_goal(session: Session, goal: Goal, now: datetime) -> None:
    """Linked projects and tasks stay where they are; they read as goal-less until restore."""
    goal.deleted_at = now
    session.commit()


def restore_goal(session: Session, goal: Goal) -> Goal:
    goal.deleted_at = None
    session.commit()
    return goal
