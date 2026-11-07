from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.system import service
from app.system.schemas import HealthChecks, HealthReport, LiveReport, WorkerCheck

router = APIRouter(prefix="/health", tags=["system"])


@router.get("/live")
def live() -> LiveReport:
    return LiveReport()


@router.get("", responses={503: {"model": HealthReport}})
def health(
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> HealthReport:
    now = datetime.now(UTC)
    database = service.probe_database(session)
    if database.status == "down":
        worker = WorkerCheck(status="down", detail="Unknown while database is unreachable")
    else:
        worker = service.classify_worker(
            service.read_heartbeat(session, service.WORKER_SERVICE),
            now,
            timedelta(seconds=settings.worker_heartbeat_seconds),
        )

    report = HealthReport(
        status=service.overall_status(database, worker),
        environment=settings.environment,
        checked_at=now,
        checks=HealthChecks(database=database, worker=worker),
    )
    if report.status == "down":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return report
