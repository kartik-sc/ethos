from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.system.models import ServiceHeartbeat
from app.system.service import WORKER_SERVICE, record_heartbeat
from app.worker.main import beat


def test_beat_records_worker_heartbeat(session: Session) -> None:
    started_at = datetime.now(UTC)
    beat(started_at)

    row = session.scalars(select(ServiceHeartbeat)).one()
    assert row.service == WORKER_SERVICE
    assert row.started_at == started_at


def test_heartbeat_upsert_keeps_a_single_row(session: Session) -> None:
    first = datetime.now(UTC)
    record_heartbeat(session, WORKER_SERVICE, first, first)
    record_heartbeat(session, WORKER_SERVICE, first, first + timedelta(seconds=30))

    rows = session.scalars(select(ServiceHeartbeat)).all()
    assert len(rows) == 1
    assert rows[0].last_seen_at == first + timedelta(seconds=30)
