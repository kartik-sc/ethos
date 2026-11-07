from datetime import date, timedelta
from typing import Any

from fastapi.testclient import TestClient

TASKS = "/api/v1/tasks"


def create(client: TestClient, **fields: Any) -> dict[str, Any]:
    response = client.post(TASKS, json={"title": "Write DBMS report", **fields})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def titles(client: TestClient, view: str = "open") -> list[str]:
    return [task["title"] for task in client.get(TASKS, params={"view": view}).json()]


def test_create_applies_defaults_and_trims_title(client: TestClient) -> None:
    task = create(client, title="  Revise OS notes  ")
    assert task["title"] == "Revise OS notes"
    assert task["status"] == "open"
    assert task["priority"] == "normal"
    assert task["completed_at"] is None


def test_create_rejects_blank_title_and_bad_duration(client: TestClient) -> None:
    assert client.post(TASKS, json={"title": "   "}).status_code == 422
    assert client.post(TASKS, json={"title": "x", "planned_minutes": 1}).status_code == 422


def test_open_view_orders_by_due_date_then_undated(client: TestClient) -> None:
    today = date.today()
    create(client, title="undated")
    create(client, title="later", due_date=str(today + timedelta(days=5)))
    create(client, title="sooner", due_date=str(today + timedelta(days=1)))
    assert titles(client) == ["sooner", "later", "undated"]


def test_completing_moves_task_to_done_view(client: TestClient) -> None:
    task = create(client)
    response = client.patch(f"{TASKS}/{task['id']}", json={"status": "done"})
    assert response.status_code == 200
    assert response.json()["completed_at"] is not None
    assert titles(client) == []
    assert titles(client, "done") == ["Write DBMS report"]


def test_partial_update_leaves_other_fields_alone(client: TestClient) -> None:
    task = create(client, priority="high", description="chapter 3")
    response = client.patch(f"{TASKS}/{task['id']}", json={"due_date": None, "title": "Renamed"})
    body = response.json()
    assert body["title"] == "Renamed"
    assert body["priority"] == "high"
    assert body["description"] == "chapter 3"


def test_null_title_is_rejected(client: TestClient) -> None:
    task = create(client)
    assert client.patch(f"{TASKS}/{task['id']}", json={"title": None}).status_code == 422


def test_trash_and_restore(client: TestClient) -> None:
    task = create(client)
    assert client.delete(f"{TASKS}/{task['id']}").status_code == 204
    assert titles(client) == []
    assert titles(client, "trash") == ["Write DBMS report"]
    assert client.patch(f"{TASKS}/{task['id']}", json={"title": "x"}).status_code == 404

    restored = client.post(f"{TASKS}/{task['id']}/restore")
    assert restored.status_code == 200
    assert restored.json()["deleted_at"] is None
    assert titles(client) == ["Write DBMS report"]


def test_restore_of_live_task_is_not_found(client: TestClient) -> None:
    task = create(client)
    assert client.post(f"{TASKS}/{task['id']}/restore").status_code == 404


def test_unknown_task_is_not_found(client: TestClient) -> None:
    missing = "00000000-0000-7000-8000-000000000000"
    assert client.delete(f"{TASKS}/{missing}").status_code == 404


def test_next_action_is_empty_without_tasks(client: TestClient) -> None:
    assert client.get(f"{TASKS}/next-action").json() == {
        "task": None,
        "reason": None,
        "overridden": False,
    }


def test_override_is_honoured_until_the_chosen_task_closes(client: TestClient) -> None:
    urgent = create(client, title="urgent", due_date=str(date.today() - timedelta(days=1)))
    chosen = create(client, title="chosen")

    suggested = client.get(f"{TASKS}/next-action").json()
    assert suggested["task"]["id"] == urgent["id"]

    response = client.post(
        f"{TASKS}/next-action/override",
        json={"suggested_task_id": urgent["id"], "chosen_task_id": chosen["id"]},
    )
    assert response.status_code == 204

    current = client.get(f"{TASKS}/next-action").json()
    assert current["task"]["id"] == chosen["id"]
    assert current["overridden"] is True

    client.patch(f"{TASKS}/{chosen['id']}", json={"status": "done"})
    assert client.get(f"{TASKS}/next-action").json()["task"]["id"] == urgent["id"]


def test_cannot_override_with_a_closed_task(client: TestClient) -> None:
    task = create(client)
    client.patch(f"{TASKS}/{task['id']}", json={"status": "cancelled"})
    response = client.post(
        f"{TASKS}/next-action/override",
        json={"suggested_task_id": None, "chosen_task_id": task["id"]},
    )
    assert response.status_code == 404
