import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.clock import local_today
from app.core.db import get_session
from app.preferences.deps import TimezoneDep
from app.quotes import service
from app.quotes.models import Quote
from app.quotes.schemas import QuoteRead, QuoteWrite

router = APIRouter(prefix="/quotes", tags=["quotes"])

SessionDep = Annotated[Session, Depends(get_session)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Quote not found"}}


def _load(session: Session, quote_id: uuid.UUID) -> Quote:
    try:
        return service.get_quote(session, quote_id)
    except service.QuoteNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quote not found") from None


@router.get("")
def list_quotes(session: SessionDep) -> list[QuoteRead]:
    return [QuoteRead.model_validate(quote) for quote in service.list_quotes(session)]


@router.get("/today")
def quote_of_the_day(session: SessionDep, timezone: TimezoneDep) -> QuoteRead | None:
    today = local_today(datetime.now(UTC), timezone)
    quote = service.quote_of_the_day(session, today)
    return QuoteRead.model_validate(quote) if quote else None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_quote(data: QuoteWrite, session: SessionDep) -> QuoteRead:
    return QuoteRead.model_validate(service.create_quote(session, data))


@router.put("/{quote_id}", responses=NOT_FOUND)
def update_quote(quote_id: uuid.UUID, data: QuoteWrite, session: SessionDep) -> QuoteRead:
    return QuoteRead.model_validate(service.update_quote(session, _load(session, quote_id), data))


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_quote(quote_id: uuid.UUID, session: SessionDep) -> None:
    service.delete_quote(session, _load(session, quote_id))
