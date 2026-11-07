import uuid
from collections.abc import Iterable, Sequence
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.projects.models import Project
from app.projects.schemas import ProjectCreate, ProjectUpdate, ProjectView, TaskCounts
from app.tasks.models import Task, TaskStatus


class ProjectNotFoundError(Exception):
    pass


def list_projects(session: Session, view: ProjectView) -> Sequence[Project]:
    query = select(Project)
    if view == "active":
        query = query.where(Project.deleted_at.is_(None)).order_by(
            Project.due_date.asc().nulls_last(), Project.created_at.desc()
        )
    else:
        query = query.where(Project.deleted_at.is_not(None)).order_by(Project.deleted_at.desc())
    return session.scalars(query).all()


def task_counts(session: Session, project_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, TaskCounts]:
    ids = list(project_ids)
    if not ids:
        return {}
    is_open = Task.status == TaskStatus.OPEN
    rows = session.execute(
        select(
            Task.project_id,
            func.count().filter(is_open),
            func.count().filter(Task.status == TaskStatus.DONE),
            func.min(Task.due_date).filter(is_open),
        )
        .where(Task.project_id.in_(ids), Task.deleted_at.is_(None))
        .group_by(Task.project_id)
    ).all()
    return {
        project_id: TaskCounts(open=open_count, done=done_count, next_due=next_due)
        for project_id, open_count, done_count, next_due in rows
        if project_id is not None
    }


def get_project(session: Session, project_id: uuid.UUID, *, trashed: bool = False) -> Project:
    project = session.get(Project, project_id)
    if project is None or (project.deleted_at is not None) != trashed:
        raise ProjectNotFoundError
    return project


def create_project(session: Session, data: ProjectCreate) -> Project:
    project = Project(**data.model_dump())
    session.add(project)
    session.commit()
    return project


def update_project(session: Session, project: Project, changes: ProjectUpdate) -> Project:
    for name, value in changes.model_dump(exclude_unset=True).items():
        setattr(project, name, value)
    session.commit()
    return project


def trash_project(session: Session, project: Project, now: datetime) -> int:
    """Moves the project and its live tasks to Trash together, sharing one timestamp."""
    project.deleted_at = now
    moved = session.scalars(
        update(Task)
        .where(Task.project_id == project.id, Task.deleted_at.is_(None))
        .values(deleted_at=now)
        .returning(Task.id)
    ).all()
    session.commit()
    return len(moved)


def restore_project(session: Session, project: Project) -> Project:
    """Brings back the tasks trashed with the project; tasks trashed on their own stay there."""
    session.execute(
        update(Task)
        .where(Task.project_id == project.id, Task.deleted_at == project.deleted_at)
        .values(deleted_at=None)
    )
    project.deleted_at = None
    session.commit()
    return project
