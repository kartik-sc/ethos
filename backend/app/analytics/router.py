from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.analytics import service
from app.analytics.rules import MAX_MONTHS_BACK, MAX_WEEKS_BACK, Period
from app.analytics.schemas import AnalyticsReport
from app.core.db import get_session
from app.preferences.deps import TimezoneDep

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("")
def analytics(
    session: Annotated[Session, Depends(get_session)],
    timezone: TimezoneDep,
    period: Annotated[Period, Query()] = "week",
    offset: Annotated[int, Query(le=0, ge=-MAX_WEEKS_BACK)] = 0,
) -> AnalyticsReport:
    """Numbers for one week or month (offset 0 = current, -1 = previous…), with the window
    before it for comparison and plain factual observations."""
    if period == "month" and offset < -MAX_MONTHS_BACK:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Too far back")
    return service.report(session, period, offset, datetime.now(UTC), timezone)
