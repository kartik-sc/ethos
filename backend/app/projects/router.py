import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.calendar.service import release_task_blocks
from app.core.db import get_session
from app.goals.service import GoalUnavailableError
from app.projects import service
from app.projects.models import Project
from app.projects.schemas import (
    ProjectCreate,
    ProjectRead,
    ProjectTrashed,
    ProjectUpdate,
    ProjectView,
    TaskCounts,
)
from app.tasks.models import Task

router = APIRouter(prefix="/projects", tags=["projects"])

SessionDep = Annotated[Session, Depends(get_session)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Project not found"}}


def _load(session: Session, project_id: uuid.UUID, *, trashed: bool = False) -> Project:
    try:
        return service.get_project(session, project_id, trashed=trashed)
    except service.ProjectNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found") from None


def _read(project: Project, counts: TaskCounts | None) -> ProjectRead:
    fields = {name: getattr(project, name) for name in ProjectRead.model_fields if name != "tasks"}
    return ProjectRead(**fields, tasks=counts or TaskCounts())


def _read_one(session: Session, project: Project) -> ProjectRead:
    return _read(project, service.task_counts(session, [project.id]).get(project.id))


@router.get("")
def list_projects(
    session: SessionDep,
    view: Annotated[ProjectView, Query()] = "active",
    goal_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[ProjectRead]:
    projects = service.list_projects(session, view, goal_id)
    counts = service.task_counts(session, (project.id for project in projects))
    return [_read(project, counts.get(project.id)) for project in projects]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreate, session: SessionDep) -> ProjectRead:
    try:
        return _read(service.create_project(session, data), None)
    except GoalUnavailableError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Goal not found") from None


@router.get("/{project_id}", responses=NOT_FOUND)
def get_project(project_id: uuid.UUID, session: SessionDep) -> ProjectRead:
    return _read_one(session, _load(session, project_id))


@router.patch("/{project_id}", responses=NOT_FOUND)
def update_project(
    project_id: uuid.UUID, changes: ProjectUpdate, session: SessionDep
) -> ProjectRead:
    project = _load(session, project_id)
    try:
        service.update_project(session, project, changes)
    except GoalUnavailableError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Goal not found") from None
    return _read_one(session, project)


@router.delete("/{project_id}", responses=NOT_FOUND)
def trash_project(project_id: uuid.UUID, session: SessionDep) -> ProjectTrashed:
    now = datetime.now(UTC)
    moved = service.trash_project(session, _load(session, project_id), now)
    task_ids = session.scalars(select(Task.id).where(Task.project_id == project_id)).all()
    release_task_blocks(session, task_ids, now)
    return ProjectTrashed(tasks_moved=moved)


@router.post("/{project_id}/restore", responses=NOT_FOUND)
def restore_project(project_id: uuid.UUID, session: SessionDep) -> ProjectRead:
    project = service.restore_project(session, _load(session, project_id, trashed=True))
    return _read_one(session, project)
