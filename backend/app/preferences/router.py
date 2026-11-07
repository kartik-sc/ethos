from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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
    return PreferencesRead.model_validate(service.update_preferences(session, changes))
