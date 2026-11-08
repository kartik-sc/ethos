from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.models import IntegrationToken

TOKENS = "/api/v1/integration-tokens"
CAPTURE = "/api/v1/capture"


def new_token(client: TestClient, name: str = "iPhone") -> dict[str, Any]:
    response = client.post(TOKENS, json={"name": name})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def capture(client: TestClient, token: str, text: str) -> Any:
    return client.post(CAPTURE, json={"text": text}, headers={"Authorization": f"Bearer {token}"})


def inbox_contents(client: TestClient) -> list[str]:
    return [item["content"] for item in client.get("/api/v1/inbox").json()]


def test_token_is_shown_once_and_only_its_hash_is_stored(
    client: TestClient, session: Session
) -> None:
    created = new_token(client)

    assert created["token"].startswith("eth_")
    assert created["prefix"] == created["token"][:12]
    stored = session.scalars(select(IntegrationToken)).one()
    assert created["token"] not in (stored.token_hash, stored.prefix)
    listed = client.get(TOKENS).json()
    assert [token["name"] for token in listed] == ["iPhone"]
    assert "token" not in listed[0]


def test_plain_text_goes_to_the_inbox(client: TestClient) -> None:
    token = new_token(client)["token"]

    response = capture(client, token, "look into renewing passport")

    assert response.status_code == 201
    assert response.json()["status"] == "inbox"
    [item] = client.get("/api/v1/inbox").json()
    assert item["content"] == "look into renewing passport"
    assert item["source"] == "shortcut"
    assert client.get(TOKENS).json()[0]["last_used_at"] is not None


def test_clear_command_executes(client: TestClient) -> None:
    token = new_token(client)["token"]

    response = capture(client, token, "/task Book dentist by 2026-12-01")

    body = response.json()
    assert body["status"] == "executed"
    assert body["record_kind"] == "task"
    assert [task["title"] for task in client.get("/api/v1/tasks").json()] == ["Book dentist"]
    assert inbox_contents(client) == []


def test_command_needing_an_answer_is_kept_in_the_inbox(client: TestClient) -> None:
    token = new_token(client)["token"]

    response = capture(client, token, "/deadline Scholarship form")

    body = response.json()
    assert body["status"] == "inbox"
    assert body["message"].startswith("Saved to Inbox · ")
    assert inbox_contents(client) == ["/deadline Scholarship form"]
    assert client.get("/api/v1/tasks").json() == []


def test_possible_duplicate_is_not_created(client: TestClient) -> None:
    token = new_token(client)["token"]
    capture(client, token, "/task Book dentist")

    response = capture(client, token, "/task book dentist")

    assert response.json()["status"] == "inbox"
    assert len(client.get("/api/v1/tasks").json()) == 1
    assert inbox_contents(client) == ["/task book dentist"]


def test_missing_unknown_and_revoked_tokens_are_refused(client: TestClient) -> None:
    created = new_token(client)

    assert client.post(CAPTURE, json={"text": "x"}).status_code == 401
    assert capture(client, "eth_not-a-real-token", "x").status_code == 401
    assert capture(client, "something-else", "x").status_code == 401

    revoked = client.delete(f"{TOKENS}/{created['id']}")
    assert revoked.json()["revoked_at"] is not None
    assert capture(client, created["token"], "x").status_code == 401
    assert inbox_contents(client) == []


def test_revoking_one_token_leaves_others_working(client: TestClient) -> None:
    phone = new_token(client, "iPhone")
    laptop = new_token(client, "Laptop")
    client.delete(f"{TOKENS}/{phone['id']}")

    assert capture(client, laptop["token"], "still works").status_code == 201
    listed = client.get(TOKENS).json()
    assert [token["name"] for token in listed] == ["Laptop", "iPhone"], "revoked last"
