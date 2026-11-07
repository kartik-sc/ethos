from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.clock import local_today
from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.dashboard import service
from app.dashboard.schemas import Dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Dashboard:
    now = datetime.now(UTC)
    today = local_today(now, settings.default_timezone)
    return Dashboard(
        deadlines=service.deadlines(session, today),
        tasks=service.task_counts(session, now, settings.default_timezone),
    )
