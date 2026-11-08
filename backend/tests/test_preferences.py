from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

PREFERENCES = "/api/v1/preferences"


def test_defaults(client: TestClient) -> None:
    assert client.get(PREFERENCES).json() == {
        "archive_after_days": 30,
        "timezone": "Asia/Kolkata",
        "default_task_minutes": 60,
        "day_starts_at": "08:00:00",
        "day_ends_at": "22:00:00",
    }


def test_timezone_must_be_a_known_iana_name(client: TestClient) -> None:
    assert client.patch(PREFERENCES, json={"timezone": "Mars/Olympus"}).status_code == 422
    changed = client.patch(PREFERENCES, json={"timezone": "Europe/London"})
    assert changed.json()["timezone"] == "Europe/London"


def test_day_window_must_be_ordered_even_across_partial_updates(client: TestClient) -> None:
    assert client.patch(PREFERENCES, json={"day_starts_at": "23:00"}).status_code == 422
    assert (
        client.patch(PREFERENCES, json={"day_starts_at": "10:00", "day_ends_at": "09:00"})
    ).status_code == 422
    ok = client.patch(PREFERENCES, json={"day_starts_at": "06:30", "day_ends_at": "23:30"})
    assert ok.json()["day_starts_at"] == "06:30:00"
    assert client.patch(PREFERENCES, json={"default_task_minutes": 2}).status_code == 422


def test_today_follows_the_configured_timezone(client: TestClient) -> None:
    # UTC-11 and UTC+14 are always on different dates, so one due date is "today" in the
    # first and already "yesterday" in the second.
    behind, ahead = "Pacific/Pago_Pago", "Pacific/Kiritimati"
    now = datetime.now(UTC)
    due = now.astimezone(ZoneInfo(behind)).date()
    assert now.astimezone(ZoneInfo(ahead)).date() - due == timedelta(days=1)
    client.post("/api/v1/tasks", json={"title": "Due today?", "due_date": due.isoformat()})

    client.patch(PREFERENCES, json={"timezone": behind})
    assert client.get("/api/v1/dashboard").json()["tasks"]["overdue"] == 0
    client.patch(PREFERENCES, json={"timezone": ahead})
    assert client.get("/api/v1/dashboard").json()["tasks"]["overdue"] == 1
