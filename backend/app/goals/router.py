import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.goals import service
from app.goals.models import Goal
from app.goals.schemas import GoalCreate, GoalProgress, GoalRead, GoalUpdate, GoalView

router = APIRouter(prefix="/goals", tags=["goals"])

SessionDep = Annotated[Session, Depends(get_session)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Goal not found"}}


def _load(session: Session, goal_id: uuid.UUID, *, trashed: bool = False) -> Goal:
    try:
        return service.get_goal(session, goal_id, trashed=trashed)
    except service.GoalNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found") from None


def _read(goal: Goal, progress: GoalProgress | None) -> GoalRead:
    fields = {name: getattr(goal, name) for name in GoalRead.model_fields if name != "progress"}
    return GoalRead(**fields, progress=progress or GoalProgress())


def _read_one(session: Session, goal: Goal) -> GoalRead:
    return _read(goal, service.progress(session, [goal.id]).get(goal.id))


@router.get("")
def list_goals(
    session: SessionDep, view: Annotated[GoalView, Query()] = "active"
) -> list[GoalRead]:
    goals = service.list_goals(session, view)
    progress = service.progress(session, (goal.id for goal in goals))
    return [_read(goal, progress.get(goal.id)) for goal in goals]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_goal(data: GoalCreate, session: SessionDep) -> GoalRead:
    return _read(service.create_goal(session, data), None)


@router.get("/{goal_id}", responses=NOT_FOUND)
def get_goal(goal_id: uuid.UUID, session: SessionDep) -> GoalRead:
    return _read_one(session, _load(session, goal_id))


@router.patch("/{goal_id}", responses=NOT_FOUND)
def update_goal(goal_id: uuid.UUID, changes: GoalUpdate, session: SessionDep) -> GoalRead:
    return _read_one(session, service.update_goal(session, _load(session, goal_id), changes))


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def trash_goal(goal_id: uuid.UUID, session: SessionDep) -> None:
    service.trash_goal(session, _load(session, goal_id), datetime.now(UTC))


@router.post("/{goal_id}/restore", responses=NOT_FOUND)
def restore_goal(goal_id: uuid.UUID, session: SessionDep) -> GoalRead:
    return _read_one(session, service.restore_goal(session, _load(session, goal_id, trashed=True)))
