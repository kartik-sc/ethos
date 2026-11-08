from collections.abc import Iterator
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated, Any
from zoneinfo import ZoneInfo

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.calendar import service
from app.calendar.models import BlockKind, CalendarBlock
from app.calendar.router import scheduling_context
from app.core.db import get_session
from app.habits.models import Habit
from app.habits.schemas import HabitCreate
from app.preferences.service import get_preferences

IST = ZoneInfo("Asia/Kolkata")
MONDAY = date(2030, 1, 7)
NOW = datetime.combine(MONDAY, time(9, 0), IST)
CAL = "/api/v1/calendar"


def at(day: date, hour: int, minute: int = 0) -> str:
    """An IST wall-clock time as the API returns it: UTC, with a Z."""
    moment = datetime.combine(day, time(hour, minute), IST).astimezone(UTC)
    return moment.isoformat().replace("+00:00", "Z")


@pytest.fixture(autouse=True)
def fixed_now(client: TestClient) -> Iterator[None]:
    from app.main import app

    def pinned(session: Annotated[Session, Depends(get_session)]) -> service.Context:
        return service.Context.of(get_preferences(session), NOW)

    app.dependency_overrides[scheduling_context] = pinned
    yield
    app.dependency_overrides.pop(scheduling_context, None)


def task(client: TestClient, title: str, **fields: Any) -> dict[str, Any]:
    response = client.post("/api/v1/tasks", json={"title": title, **fields})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def event(session: Session, start: str, end: str, title: str = "Lecture") -> None:
    session.add(
        CalendarBlock(
            kind=BlockKind.EVENT,
            title=title,
            starts_at=datetime.fromisoformat(start),
            ends_at=datetime.fromisoformat(end),
            fixed=True,
            external_id=f"google-{start}",
        )
    )
    session.commit()


def test_status_is_honest_about_the_missing_connection(client: TestClient) -> None:
    assert client.get(f"{CAL}/status").json() == {"connected": False, "pending": 0, "unbooked": []}


def test_scheduling_a_task_uses_its_duration_and_queues_the_sync(client: TestClient) -> None:
    created = task(client, "Write report", planned_minutes=90, due_date="2030-01-10")

    response = client.post(f"{CAL}/tasks/{created['id']}/schedule")

    assert response.status_code == 201, response.text
    block = response.json()
    assert (block["starts_at"], block["ends_at"]) == (at(MONDAY, 9), at(MONDAY, 10, 30))
    assert block["kind"] == "task" and block["sync"] == "pending"
    assert client.get(f"{CAL}/status").json()["pending"] == 1
    listed = client.get(f"{CAL}/blocks").json()
    assert [b["title"] for b in listed] == ["Write report"]


def test_default_duration_applies_without_a_planned_one(client: TestClient) -> None:
    client.patch("/api/v1/preferences", json={"default_task_minutes": 45})
    block = client.post(f"{CAL}/tasks/{task(client, 'Email prof')['id']}/schedule").json()
    assert block["ends_at"] == at(MONDAY, 9, 45)


def test_fixed_events_are_never_overlapped(client: TestClient, session: Session) -> None:
    event(session, at(MONDAY, 9), at(MONDAY, 13))
    block = client.post(f"{CAL}/tasks/{task(client, 'Study', planned_minutes=60)['id']}/schedule")
    assert block.json()["starts_at"] == at(MONDAY, 13)


def test_no_slot_before_the_deadline_is_reported_not_overbooked(
    client: TestClient, session: Session
) -> None:
    event(session, at(MONDAY, 8), at(MONDAY, 22), "Exam day")
    created = task(client, "Submit form", planned_minutes=30, due_date=MONDAY.isoformat())

    response = client.post(f"{CAL}/tasks/{created['id']}/schedule")

    assert response.status_code == 409
    assert response.json()["detail"] == "No free 30-minute slot before Mon 07 Jan"
    assert [b["title"] for b in client.get(f"{CAL}/blocks").json()] == ["Exam day"]


def test_a_task_is_scheduled_once_at_a_time(client: TestClient) -> None:
    created = task(client, "Read paper", planned_minutes=30)
    client.post(f"{CAL}/tasks/{created['id']}/schedule")
    again = client.post(f"{CAL}/tasks/{created['id']}/schedule")
    assert again.status_code == 409
    assert again.json()["detail"].startswith("Already scheduled for Mon 07 Jan, 09:00")


def test_plan_previews_then_applies_in_next_action_order(client: TestClient) -> None:
    task(client, "Someday", planned_minutes=60)
    task(client, "Due tomorrow", planned_minutes=60, due_date="2030-01-08")
    task(client, "No duration, no deadline")
    task(client, "Overdue", due_date="2030-01-01")

    preview = client.post(f"{CAL}/plan", json={"horizon_days": 7}).json()

    assert preview["applied"] is False
    assert [p["title"] for p in preview["placed"]] == ["Due tomorrow", "Someday"]
    assert [(u["title"], u["reason"]) for u in preview["unplaced"]] == [
        ("Overdue", "deadline has passed")
    ]
    assert client.get(f"{CAL}/blocks").json() == []

    applied = client.post(f"{CAL}/plan", json={"horizon_days": 7, "apply": True}).json()
    assert applied["placed"] == preview["placed"]
    assert len(client.get(f"{CAL}/blocks").json()) == 2
    again = client.post(f"{CAL}/plan", json={"horizon_days": 7}).json()
    assert again["placed"] == [], "scheduled tasks are not planned twice"


def test_plan_lists_what_does_not_fit(client: TestClient, session: Session) -> None:
    event(session, at(MONDAY, 8), at(MONDAY, 21), "Hackathon")
    task(client, "First", planned_minutes=60, due_date=MONDAY.isoformat())
    task(client, "Second", planned_minutes=60, due_date=MONDAY.isoformat())

    result = client.post(f"{CAL}/plan", json={"horizon_days": 1, "apply": True}).json()

    assert [p["title"] for p in result["placed"]] == ["First"]
    assert [u["title"] for u in result["unplaced"]] == ["Second"]


def test_removing_a_block_frees_the_time_but_events_stay(
    client: TestClient, session: Session
) -> None:
    created = task(client, "Draft", planned_minutes=60)
    block = client.post(f"{CAL}/tasks/{created['id']}/schedule").json()
    assert client.delete(f"{CAL}/blocks/{block['id']}").status_code == 204
    assert client.get(f"{CAL}/blocks").json() == []
    assert client.get(f"{CAL}/status").json()["pending"] == 0, "never synced, nothing to undo"

    event(session, at(MONDAY, 14), at(MONDAY, 15))
    event_id = client.get(f"{CAL}/blocks").json()[0]["id"]
    assert client.delete(f"{CAL}/blocks/{event_id}").status_code == 409


def test_blocks_of_trashed_tasks_disappear_and_free_their_time(client: TestClient) -> None:
    created = task(client, "Abandoned", planned_minutes=60)
    client.post(f"{CAL}/tasks/{created['id']}/schedule")
    client.delete(f"/api/v1/tasks/{created['id']}")

    assert client.get(f"{CAL}/blocks").json() == []
    other = client.post(f"{CAL}/tasks/{task(client, 'Next', planned_minutes=60)['id']}/schedule")
    assert other.json()["starts_at"] == at(MONDAY, 9)


def test_work_that_no_longer_fits_today_goes_to_the_next_day(client: TestClient) -> None:
    client.patch("/api/v1/preferences", json={"day_starts_at": "08:00", "day_ends_at": "09:30"})
    created = task(client, "Tomorrow work", planned_minutes=60)

    block = client.post(f"{CAL}/tasks/{created['id']}/schedule").json()

    tomorrow = MONDAY + timedelta(days=1)
    assert block["starts_at"] == at(tomorrow, 8)
    assert client.get(f"{CAL}/blocks").json() == []
    listed = client.get(f"{CAL}/blocks", params={"start": tomorrow.isoformat()}).json()
    assert [b["title"] for b in listed] == ["Tomorrow work"]


def test_work_longer_than_the_day_is_refused(client: TestClient) -> None:
    client.patch("/api/v1/preferences", json={"day_starts_at": "08:00", "day_ends_at": "08:30"})
    created = task(client, "Long", planned_minutes=60)
    response = client.post(f"{CAL}/tasks/{created['id']}/schedule")
    assert response.status_code == 409
    assert response.json()["detail"] == "It is longer than the working day in Settings"


def test_planning_books_habit_sessions_first(client: TestClient, session: Session) -> None:
    data = HabitCreate.model_validate(
        {
            "title": "LeetCode",
            "cadence": "daily",
            "weekdays": list(range(7)),
            "protected": True,
            "session_minutes": 120,
            "session_time": "09:00",
        }
    )
    session.add(Habit(**data.model_dump()))
    session.commit()
    task(client, "Essay", planned_minutes=60, due_date=MONDAY.isoformat())

    result = client.post(f"{CAL}/plan", json={"horizon_days": 1}).json()

    assert result["placed"][0]["starts_at"] == at(MONDAY, 11)
    kinds = [(b["kind"], b["fixed"]) for b in client.get(f"{CAL}/blocks").json()]
    assert kinds == [("habit", True)]
