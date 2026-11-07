from typing import Any

from fastapi.testclient import TestClient

from app.inbox.service import split_capture

INBOX = "/api/v1/inbox"


def capture(client: TestClient, content: str) -> dict[str, Any]:
    response = client.post(INBOX, json={"content": content})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def contents(client: TestClient, view: str = "open") -> list[str]:
    return [item["content"] for item in client.get(INBOX, params={"view": view}).json()]


def test_split_capture_uses_the_first_line() -> None:
    assert split_capture("Call the bank") == ("Call the bank", None)
    assert split_capture("\nBuy paint\nwhite, 2 litres") == (
        "Buy paint",
        "\nBuy paint\nwhite, 2 litres",
    )
    title, _ = split_capture("x" * 300)
    assert len(title) == 200


def test_open_items_are_chronological(client: TestClient) -> None:
    capture(client, "first")
    capture(client, "second")
    assert contents(client) == ["first", "second"]


def test_blank_capture_is_rejected(client: TestClient) -> None:
    assert client.post(INBOX, json={"content": "   "}).status_code == 422


def test_convert_to_task_creates_it_and_records_the_link(client: TestClient) -> None:
    item = capture(client, "Renew passport\nappointment needs photos")
    response = client.post(
        f"{INBOX}/{item['id']}/convert", json={"kind": "task", "due_date": "2026-12-01"}
    )

    body = response.json()
    assert body["outcome"] == "task"
    task = client.get("/api/v1/tasks").json()[0]
    assert task["id"] == body["result_id"]
    assert task["title"] == "Renew passport"
    assert task["description"] == "Renew passport\nappointment needs photos"
    assert task["due_date"] == "2026-12-01"
    assert contents(client) == []


def test_convert_to_goal_and_project(client: TestClient) -> None:
    goal_item = capture(client, "Learn Japanese")
    project_item = capture(client, "build a CLI tracker")
    client.post(f"{INBOX}/{goal_item['id']}/convert", json={"kind": "goal"})
    client.post(
        f"{INBOX}/{project_item['id']}/convert",
        json={"kind": "project", "title": "CLI habit tracker"},
    )

    assert [g["title"] for g in client.get("/api/v1/goals").json()] == ["Learn Japanese"]
    project = client.get("/api/v1/projects").json()[0]
    assert project["title"] == "CLI habit tracker"
    assert project["description"] == "build a CLI tracker"


def test_dismissed_items_are_kept_and_can_be_reopened(client: TestClient) -> None:
    item = capture(client, "maybe learn the banjo")
    dismissed = client.post(f"{INBOX}/{item['id']}/resolve", json={"outcome": "dismissed"})
    assert dismissed.json()["outcome"] == "dismissed"
    assert contents(client, "processed") == ["maybe learn the banjo"]

    reopened = client.post(f"{INBOX}/{item['id']}/reopen")
    assert reopened.json()["outcome"] is None
    assert contents(client) == ["maybe learn the banjo"]


def test_processed_items_cannot_be_edited_or_processed_again(client: TestClient) -> None:
    item = capture(client, "done thing")
    client.post(f"{INBOX}/{item['id']}/resolve", json={"outcome": "done"})

    assert client.patch(f"{INBOX}/{item['id']}", json={"content": "x"}).status_code == 404
    assert client.post(f"{INBOX}/{item['id']}/convert", json={"kind": "task"}).status_code == 404


def test_edit_open_item(client: TestClient) -> None:
    item = capture(client, "typo")
    edited = client.patch(f"{INBOX}/{item['id']}", json={"content": "fixed"})
    assert edited.json()["content"] == "fixed"
