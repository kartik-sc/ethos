from collections.abc import Iterator
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.system.service import WORKER_SERVICE, record_heartbeat


def test_live_does_not_need_the_database(client: TestClient) -> None:
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_degraded_until_worker_reports(client: TestClient) -> None:
    body = client.get("/api/v1/health").json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"]["status"] == "ok"
    assert body["checks"]["worker"]["status"] == "down"


def test_health_is_ok_with_fresh_heartbeat(client: TestClient, session: Session) -> None:
    now = datetime.now(UTC)
    record_heartbeat(session, WORKER_SERVICE, now, now)

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_returns_503_when_database_unreachable(client: TestClient) -> None:
    dead_engine = create_engine(
        "postgresql+psycopg://nobody:nothing@127.0.0.1:1/none",
        connect_args={"connect_timeout": 1},
    )

    def unreachable_session() -> Iterator[Session]:
        with Session(dead_engine) as dead_session:
            yield dead_session

    client.app.dependency_overrides[get_session] = unreachable_session  # type: ignore[attr-defined]
    try:
        response = client.get("/api/v1/health")
    finally:
        client.app.dependency_overrides.clear()  # type: ignore[attr-defined]

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "down"
    assert "nothing" not in response.text
