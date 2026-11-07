import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.inbox import service
from app.inbox.models import InboxItem, Outcome
from app.inbox.schemas import (
    ConvertRequest,
    InboxCreate,
    InboxRead,
    InboxUpdate,
    InboxView,
    ResolveRequest,
)

router = APIRouter(prefix="/inbox", tags=["inbox"])

SessionDep = Annotated[Session, Depends(get_session)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Inbox item not found"}}


def _load(session: Session, item_id: uuid.UUID, *, processed: bool = False) -> InboxItem:
    try:
        return service.get_item(session, item_id, processed=processed)
    except service.InboxItemNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inbox item not found") from None


@router.get("")
def list_items(
    session: SessionDep, view: Annotated[InboxView, Query()] = "open"
) -> list[InboxRead]:
    return [InboxRead.model_validate(item) for item in service.list_items(session, view)]


@router.post("", status_code=status.HTTP_201_CREATED)
def capture(data: InboxCreate, session: SessionDep) -> InboxRead:
    return InboxRead.model_validate(service.capture(session, data.content))


@router.patch("/{item_id}", responses=NOT_FOUND)
def edit(item_id: uuid.UUID, data: InboxUpdate, session: SessionDep) -> InboxRead:
    return InboxRead.model_validate(service.edit(session, _load(session, item_id), data.content))


@router.post("/{item_id}/convert", responses=NOT_FOUND)
def convert(item_id: uuid.UUID, data: ConvertRequest, session: SessionDep) -> InboxRead:
    item = service.convert(session, _load(session, item_id), data, datetime.now(UTC))
    return InboxRead.model_validate(item)


@router.post("/{item_id}/resolve", responses=NOT_FOUND)
def resolve(item_id: uuid.UUID, data: ResolveRequest, session: SessionDep) -> InboxRead:
    item = service.resolve(
        session, _load(session, item_id), Outcome(data.outcome), datetime.now(UTC)
    )
    return InboxRead.model_validate(item)


@router.post("/{item_id}/reopen", responses=NOT_FOUND)
def reopen(item_id: uuid.UUID, session: SessionDep) -> InboxRead:
    item = service.reopen(session, _load(session, item_id, processed=True))
    return InboxRead.model_validate(item)
