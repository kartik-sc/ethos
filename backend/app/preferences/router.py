from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.calendar import habit_sessions
from app.calendar.service import Context
from app.core.db import get_session
from app.preferences import service
from app.preferences.schemas import PreferencesRead, PreferencesUpdate

router = APIRouter(prefix="/preferences", tags=["preferences"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("")
def read_preferences(session: SessionDep) -> PreferencesRead:
    return PreferencesRead.model_validate(service.get_preferences(session))


@router.patch("")
def update_preferences(changes: PreferencesUpdate, session: SessionDep) -> PreferencesRead:
    before = PreferencesRead.model_validate(service.get_preferences(session))
    try:
        preferences = service.update_preferences(session, changes)
    except service.InvalidPreferencesError as invalid:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, invalid.message) from None
    after = PreferencesRead.model_validate(preferences)
    moved = ("timezone", "day_starts_at", "day_ends_at")
    if any(getattr(before, name) != getattr(after, name) for name in moved):
        # Booked habit sessions keep their local clock time in the new zone or window.
        now = datetime.now(UTC)
        habit_sessions.release_future(session, now)
        context = Context.of(preferences, now)
        habit_sessions.refresh(session, context, context.today + timedelta(days=1))
    return after
