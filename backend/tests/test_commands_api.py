from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient

from app.commands.service import similarity
from app.core.clock import local_today

PREVIEW = "/api/v1/commands/preview"
RUN = "/api/v1/commands/run"
TODAY = local_today(datetime.now(UTC), "Asia/Kolkata")


def run(client: TestClient, text: str, **extra: Any) -> Any:
    return client.post(RUN, json={"text": text, **extra})


def preview(client: TestClient, text: str) -> dict[str, Any]:
    body: dict[str, Any] = client.post(PREVIEW, json={"text": text}).json()
    return body


def test_similarity_ignores_case_and_punctuation() -> None:
    assert similarity("Finish DBMS report!", "finish dbms report") == 1.0
    assert similarity("Finish DBMS report", "Book flights") < 0.5


def test_preview_shows_fields_and_writes_nothing(client: TestClient) -> None:
    body = preview(client, "/task Write report tomorrow !high 45m")
    assert body["action"] == "Create task"
    assert body["ready"] is True
    labels = {field["label"]: field["value"] for field in body["fields"]}
    assert labels["Title"] == "Write report"
    assert labels["Priority"] == "high"
    assert labels["Planned"] == "45 min"
    assert client.get("/api/v1/tasks").json() == []


def test_run_creates_a_task_in_a_project(client: TestClient) -> None:
    project = client.post("/api/v1/projects", json={"title": "Portfolio website"}).json()

    response = run(client, "/task Write the about page by tomorrow @portfolio")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["record_kind"] == "task"
    task = client.get("/api/v1/tasks").json()[0]
    assert task["project_id"] == project["id"]
    assert task["due_date"] == str(TODAY + timedelta(days=1))
    assert body["message"].startswith("Task “Write the about page” created · due ")


def test_unknown_or_ambiguous_project_is_rejected(client: TestClient) -> None:
    client.post("/api/v1/projects", json={"title": "Portfolio website"})
    client.post("/api/v1/projects", json={"title": "Portfolio v2"})

    assert preview(client, "/task Thing @nothing")["error"] == "No project matches @nothing"
    ambiguous = run(client, "/task Thing @portfolio")
    assert ambiguous.status_code == 422
    assert "several projects" in ambiguous.json()["detail"]


def test_possible_duplicates_need_confirmation_and_are_never_merged(client: TestClient) -> None:
    client.post("/api/v1/tasks", json={"title": "Finish DBMS report"})

    assert [d["title"] for d in preview(client, "/task finish dbms report")["duplicates"]] == [
        "Finish DBMS report"
    ]
    refused = run(client, "/task finish dbms report")
    assert refused.status_code == 409
    assert refused.json()["duplicates"][0]["kind"] == "task"
    assert len(client.get("/api/v1/tasks").json()) == 1

    assert run(client, "/task finish dbms report", confirm_duplicate=True).status_code == 200
    assert len(client.get("/api/v1/tasks").json()) == 2


def test_a_shared_due_date_lowers_the_duplicate_bar(client: TestClient) -> None:
    due = str(TODAY + timedelta(days=3))
    client.post("/api/v1/tasks", json={"title": "Submit OS assignment", "due_date": due})
    assert preview(client, "/task Submit OS assignmnt")["duplicates"]
    assert preview(client, "/task Submit the OS lab")["duplicates"] == []


def test_deadline_without_a_date_is_a_question_not_a_guess(client: TestClient) -> None:
    body = preview(client, "/deadline Scholarship form")
    assert body["ready"] is False
    assert body["question"].startswith("When is it due?")
    assert run(client, "/deadline Scholarship form").status_code == 422


def test_project_goal_note_and_capture(client: TestClient) -> None:
    assert run(client, "/project Portfolio site #career").json()["record_kind"] == "project"
    assert run(client, "/goal Run a 10K").json()["record_kind"] == "goal"
    note = run(client, "/note Graph theory").json()
    assert note["message"] == "Note “Graph theory” created"
    assert run(client, "/note graph THEORY").status_code == 422
    assert run(client, "Remember to call the bank").json()["record_kind"] == "inbox"
    item = client.get("/api/v1/inbox").json()[0]
    assert (item["content"], item["source"]) == ("Remember to call the bank", "palette")


def test_habit_logging(client: TestClient) -> None:
    client.post(
        "/api/v1/habits",
        json={
            "title": "LeetCode",
            "cadence": "daily",
            "weekdays": [0, 1, 2, 3, 4, 5, 6],
            "measure": "amount",
            "unit": "min",
            "target_amount": 120,
        },
    )
    asks = preview(client, "/habit leet")
    assert asks["question"].startswith("How much?")

    done = run(client, "/habit leet 120")
    assert done.status_code == 200
    assert done.json()["message"] == "Logged “LeetCode” for today · 120 min"
    habit = client.get("/api/v1/habits").json()[0]
    assert habit["summary"]["today"]["state"] == "met"
    assert run(client, "/habit gym").json()["detail"] == "No habit called “gym”"


def test_search_returns_the_query(client: TestClient) -> None:
    body = run(client, "/search dbms notes").json()
    assert (body["kind"], body["query"]) == ("search", "dbms notes")


def test_a_failing_interpreter_never_loses_the_text(client: TestClient) -> None:
    from app.commands.interpreter import get_interpreter
    from app.main import app

    class Down:
        def interpret(self, text: str, today: object) -> None:
            raise TimeoutError("provider unavailable")

    app.dependency_overrides[get_interpreter] = Down
    try:
        response = run(client, "remind me to call the bank")
        slash = run(client, "/task Pay rent")
    finally:
        app.dependency_overrides.pop(get_interpreter, None)

    assert response.status_code == 200
    assert response.json()["kind"] == "capture"
    assert [item["content"] for item in client.get("/api/v1/inbox").json()] == [
        "remind me to call the bank"
    ]
    assert slash.json()["kind"] == "task", "slash commands never touch the interpreter"
