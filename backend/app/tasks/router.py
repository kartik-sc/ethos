import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.calendar.service import release_task_blocks
from app.core.db import get_session
from app.goals.service import GoalUnavailableError
from app.preferences.deps import TimezoneDep
from app.preferences.service import get_preferences
from app.tasks import service
from app.tasks.models import Task, TaskStatus
from app.tasks.schemas import (
    NextAction,
    NextActionOverrideCreate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    TaskView,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])

SessionDep = Annotated[Session, Depends(get_session)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Task not found"}}


def _load(session: Session, task_id: uuid.UUID, *, trashed: bool = False) -> Task:
    try:
        return service.get_task(session, task_id, trashed=trashed)
    except service.TaskNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found") from None


@router.get("")
def list_tasks(
    session: SessionDep,
    view: Annotated[TaskView, Query()] = "open",
    project_id: Annotated[uuid.UUID | None, Query()] = None,
    goal_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[TaskRead]:
    archive_days = get_preferences(session).archive_after_days
    archive_before = datetime.now(UTC) - timedelta(days=archive_days)
    tasks = service.list_tasks(session, view, project_id, goal_id, archive_before)
    return [TaskRead.model_validate(task) for task in tasks]


@contextmanager
def _links_must_be_live(failure_status: int) -> Iterator[None]:
    try:
        yield
    except service.ProjectUnavailableError:
        detail = (
            "Restore its project first"
            if failure_status == status.HTTP_409_CONFLICT
            else "Project not found"
        )
        raise HTTPException(failure_status, detail) from None
    except GoalUnavailableError:
        raise HTTPException(failure_status, "Goal not found") from None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, session: SessionDep) -> TaskRead:
    with _links_must_be_live(status.HTTP_422_UNPROCESSABLE_CONTENT):
        return TaskRead.model_validate(service.create_task(session, data))


@router.get("/next-action")
def next_action(session: SessionDep, timezone: TimezoneDep) -> NextAction:
    pick = service.current_next_action(session, datetime.now(UTC), timezone)
    if pick is None:
        return NextAction(task=None, reason=None, overridden=False)
    return NextAction(
        task=TaskRead.model_validate(pick.task), reason=pick.reason, overridden=pick.overridden
    )


@router.post("/next-action/override", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def override_next_action(data: NextActionOverrideCreate, session: SessionDep) -> None:
    try:
        service.record_override(session, data.suggested_task_id, data.chosen_task_id)
    except service.TaskNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found") from None


@router.patch("/{task_id}", responses=NOT_FOUND)
def update_task(task_id: uuid.UUID, changes: TaskUpdate, session: SessionDep) -> TaskRead:
    task = _load(session, task_id)
    now = datetime.now(UTC)
    with _links_must_be_live(status.HTTP_422_UNPROCESSABLE_CONTENT):
        service.update_task(session, task, changes, now)
    if task.status is not TaskStatus.OPEN:
        release_task_blocks(session, [task.id], now)
    return TaskRead.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def trash_task(task_id: uuid.UUID, session: SessionDep) -> None:
    now = datetime.now(UTC)
    service.trash_task(session, _load(session, task_id), now)
    release_task_blocks(session, [task_id], now)


@router.post(
    "/{task_id}/restore",
    responses={**NOT_FOUND, 409: {"description": "Its project is in Trash"}},
)
def restore_task(task_id: uuid.UUID, session: SessionDep) -> TaskRead:
    task = _load(session, task_id, trashed=True)
    with _links_must_be_live(status.HTTP_409_CONFLICT):
        service.restore_task(session, task)
    return TaskRead.model_validate(task)
