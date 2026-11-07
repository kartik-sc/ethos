from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.search.service import snippet
from app.tasks.models import Task

SEARCH = "/api/v1/search"


def hits(client: TestClient, q: str, **params: Any) -> list[tuple[str, str]]:
    response = client.get(SEARCH, params={"q": q, **params})
    assert response.status_code == 200, response.text
    return [(hit["kind"], hit["title"]) for hit in response.json()["hits"]]


def test_finds_matches_across_kinds_case_insensitively(client: TestClient) -> None:
    client.post("/api/v1/tasks", json={"title": "Write DBMS report"})
    client.post(
        "/api/v1/projects", json={"title": "Portfolio", "description": "uses the dbms notes"}
    )
    client.post("/api/v1/goals", json={"title": "Ace DBMS exam"})
    client.post("/api/v1/inbox", json={"content": "ask about dbms rubric"})
    client.post("/api/v1/tasks", json={"title": "Unrelated"})

    assert hits(client, "DbMs") == [
        ("task", "Write DBMS report"),
        ("project", "Portfolio"),
        ("goal", "Ace DBMS exam"),
        ("inbox", "ask about dbms rubric"),
    ]


def test_kind_area_and_status_filters(client: TestClient) -> None:
    client.post("/api/v1/tasks", json={"title": "Read paper", "area": "academics"})
    done = client.post("/api/v1/tasks", json={"title": "Read book", "area": "learning"}).json()
    client.patch(f"/api/v1/tasks/{done['id']}", json={"status": "done"})
    client.post("/api/v1/goals", json={"title": "Read 20 books"})

    assert hits(client, "read", kind="task") == [("task", "Read paper"), ("task", "Read book")]
    assert hits(client, "read", area="learning") == [("task", "Read book")]
    assert hits(client, "read", status="closed") == [("task", "Read book")]


def test_trashed_records_are_hidden_but_archived_tasks_stay_searchable(
    client: TestClient, session: Session
) -> None:
    gone = client.post("/api/v1/tasks", json={"title": "Old idea"}).json()
    client.delete(f"/api/v1/tasks/{gone['id']}")
    archived = client.post("/api/v1/tasks", json={"title": "Old report"}).json()
    client.patch(f"/api/v1/tasks/{archived['id']}", json={"status": "done"})
    session.execute(
        update(Task)
        .where(Task.title == "Old report")
        .values(completed_at=datetime.now(UTC) - timedelta(days=90))
    )
    session.commit()

    body = client.get(SEARCH, params={"q": "old"}).json()
    assert [(hit["title"], hit["status"]) for hit in body["hits"]] == [("Old report", "archived")]


def test_like_wildcards_are_matched_literally(client: TestClient) -> None:
    client.post("/api/v1/tasks", json={"title": "Raise to 100%"})
    client.post("/api/v1/tasks", json={"title": "Raise to 1000"})
    assert hits(client, "100%") == [("task", "Raise to 100%")]


def test_empty_query_is_rejected(client: TestClient) -> None:
    assert client.get(SEARCH, params={"q": ""}).status_code == 422


def test_snippet_windows_the_match() -> None:
    text = "a" * 100 + " needle " + "b" * 100
    excerpt = snippet(text, "NEEDLE")
    assert excerpt is not None
    assert excerpt.startswith("…") and excerpt.endswith("…") and "needle" in excerpt
    assert snippet("nothing here", "needle") is None


def test_notes_match_title_folder_and_tags_but_never_the_body(client: TestClient) -> None:
    folder = client.post("/api/v1/note-folders", json={"name": "Databases"}).json()
    client.post("/api/v1/notes", json={"title": "Normal forms", "folder_id": folder["id"]})
    client.post("/api/v1/notes", json={"title": "Indexes", "tags": ["dbms"]})
    client.post("/api/v1/notes", json={"title": "Diary", "content": "dbms exam was hard"})

    assert hits(client, "database", kind="note") == [("note", "Normal forms")]
    assert hits(client, "dbms", kind="note") == [("note", "Indexes")]
    body = client.get(SEARCH, params={"q": "normal"}).json()["hits"][0]
    assert (body["snippet"], body["context"]) == (None, "Databases")
