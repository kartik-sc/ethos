from datetime import UTC, datetime, timedelta

from app.system.schemas import CheckResult
from app.system.service import classify_worker, overall_status

NOW = datetime(2026, 11, 7, 12, 0, tzinfo=UTC)
INTERVAL = timedelta(seconds=30)


def test_worker_that_never_reported_is_down() -> None:
    assert classify_worker(None, NOW, INTERVAL).status == "down"


def test_recent_heartbeat_is_ok() -> None:
    check = classify_worker(NOW - timedelta(seconds=45), NOW, INTERVAL)
    assert check.status == "ok"
    assert check.last_seen_at == NOW - timedelta(seconds=45)


def test_three_missed_beats_is_degraded() -> None:
    check = classify_worker(NOW - timedelta(minutes=5), NOW, INTERVAL)
    assert check.status == "degraded"
    assert check.detail == "No heartbeat for 5 min"


def test_overall_status_prioritises_database() -> None:
    ok, degraded, down = (CheckResult(status=s) for s in ("ok", "degraded", "down"))
    assert overall_status(ok, ok) == "ok"
    assert overall_status(ok, down) == "degraded"
    assert overall_status(ok, degraded) == "degraded"
    assert overall_status(down, ok) == "down"
