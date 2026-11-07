import logging
from datetime import datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.system.models import ServiceHeartbeat
from app.system.schemas import CheckResult, CheckStatus, WorkerCheck

logger = logging.getLogger(__name__)

WORKER_SERVICE = "worker"
STALE_AFTER_MISSED_BEATS = 3


def classify_worker(
    last_seen_at: datetime | None, now: datetime, heartbeat_interval: timedelta
) -> WorkerCheck:
    if last_seen_at is None:
        return WorkerCheck(status="down", detail="Worker has never reported")
    silence = now - last_seen_at
    if silence > heartbeat_interval * STALE_AFTER_MISSED_BEATS:
        minutes = int(silence.total_seconds() // 60)
        return WorkerCheck(
            status="degraded",
            detail=f"No heartbeat for {minutes} min",
            last_seen_at=last_seen_at,
        )
    return WorkerCheck(status="ok", last_seen_at=last_seen_at)


def overall_status(database: CheckResult, worker: CheckResult) -> CheckStatus:
    if database.status == "down":
        return "down"
    if worker.status != "ok":
        return "degraded"
    return "ok"


def probe_database(session: Session) -> CheckResult:
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("database health probe failed")
        return CheckResult(status="down", detail="Database unreachable")
    return CheckResult(status="ok")


def read_heartbeat(session: Session, service: str) -> datetime | None:
    try:
        return session.scalar(
            select(ServiceHeartbeat.last_seen_at).where(ServiceHeartbeat.service == service)
        )
    except SQLAlchemyError:
        logger.exception("heartbeat read failed")
        return None


def record_heartbeat(session: Session, service: str, started_at: datetime, now: datetime) -> None:
    statement = insert(ServiceHeartbeat).values(
        service=service, started_at=started_at, last_seen_at=now
    )
    session.execute(
        statement.on_conflict_do_update(
            index_elements=[ServiceHeartbeat.service],
            set_={"started_at": started_at, "last_seen_at": now},
        )
    )
    session.commit()
