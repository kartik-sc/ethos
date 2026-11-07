import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.tasks import service
from app.tasks.models import Task
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
def list_tasks(session: SessionDep, view: Annotated[TaskView, Query()] = "open") -> list[TaskRead]:
    return [TaskRead.model_validate(task) for task in service.list_tasks(session, view)]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, session: SessionDep) -> TaskRead:
    return TaskRead.model_validate(service.create_task(session, data))


@router.get("/next-action")
def next_action(
    session: SessionDep, settings: Annotated[Settings, Depends(get_settings)]
) -> NextAction:
    pick = service.current_next_action(session, datetime.now(UTC), settings.default_timezone)
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
    task = service.update_task(session, _load(session, task_id), changes, datetime.now(UTC))
    return TaskRead.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def trash_task(task_id: uuid.UUID, session: SessionDep) -> None:
    service.trash_task(session, _load(session, task_id), datetime.now(UTC))


@router.post("/{task_id}/restore", responses=NOT_FOUND)
def restore_task(task_id: uuid.UUID, session: SessionDep) -> TaskRead:
    task = service.restore_task(session, _load(session, task_id, trashed=True))
    return TaskRead.model_validate(task)
