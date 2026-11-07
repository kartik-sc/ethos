from typing import Any

from fastapi.testclient import TestClient

GOALS = "/api/v1/goals"
PROJECTS = "/api/v1/projects"
TASKS = "/api/v1/tasks"


def post(client: TestClient, url: str, **fields: Any) -> dict[str, Any]:
    response = client.post(url, json=fields)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def progress(client: TestClient, goal_id: str) -> dict[str, int]:
    body: dict[str, int] = client.get(f"{GOALS}/{goal_id}").json()["progress"]
    return body


def test_new_goal_has_empty_progress(client: TestClient) -> None:
    goal = post(client, GOALS, title="Land a summer internship", target_date="2027-03-31")
    assert goal["progress"] == {"done": 0, "total": 0, "projects": 0, "habits": 0}


def test_progress_counts_direct_and_project_tasks_once(client: TestClient) -> None:
    goal = post(client, GOALS, title="Internship")
    other = post(client, GOALS, title="Fitness")
    project = post(client, PROJECTS, title="Portfolio", goal_id=goal["id"])

    post(client, TASKS, title="Direct", goal_id=goal["id"])
    via_project = post(client, TASKS, title="Via project", project_id=project["id"])
    client.patch(f"{TASKS}/{via_project['id']}", json={"status": "done"})
    # Its own goal wins over the project's goal, so it is not double counted.
    post(client, TASKS, title="Own goal", project_id=project["id"], goal_id=other["id"])
    cancelled = post(client, TASKS, title="Dropped", goal_id=goal["id"])
    client.patch(f"{TASKS}/{cancelled['id']}", json={"status": "cancelled"})

    assert progress(client, goal["id"]) == {"done": 1, "total": 2, "projects": 1, "habits": 0}
    assert progress(client, other["id"]) == {"done": 0, "total": 1, "projects": 0, "habits": 0}


def test_trashing_a_goal_keeps_its_projects_and_tasks(client: TestClient) -> None:
    goal = post(client, GOALS, title="Internship")
    project = post(client, PROJECTS, title="Portfolio", goal_id=goal["id"])
    task = post(client, TASKS, title="Direct", goal_id=goal["id"])

    assert client.delete(f"{GOALS}/{goal['id']}").status_code == 204

    assert client.get(f"{PROJECTS}/{project['id']}").json()["goal"] is None
    listed = client.get(TASKS).json()
    assert [(item["title"], item["goal"]) for item in listed] == [("Direct", None)]

    client.post(f"{GOALS}/{goal['id']}/restore")
    restored = client.get(TASKS).json()[0]["goal"]
    assert restored == {"id": goal["id"], "title": "Internship"}
    assert task["id"] == client.get(TASKS, params={"goal_id": goal["id"]}).json()[0]["id"]


def test_cannot_link_to_a_trashed_goal(client: TestClient) -> None:
    goal = post(client, GOALS, title="Internship")
    client.delete(f"{GOALS}/{goal['id']}")

    assert client.post(TASKS, json={"title": "x", "goal_id": goal["id"]}).status_code == 422
    assert client.post(PROJECTS, json={"title": "x", "goal_id": goal["id"]}).status_code == 422


def test_linking_an_existing_project_and_filtering(client: TestClient) -> None:
    goal = post(client, GOALS, title="Internship")
    project = post(client, PROJECTS, title="Portfolio")

    response = client.patch(f"{PROJECTS}/{project['id']}", json={"goal_id": goal["id"]})

    assert response.json()["goal"] == {"id": goal["id"], "title": "Internship"}
    linked = client.get(PROJECTS, params={"goal_id": goal["id"]}).json()
    assert [item["title"] for item in linked] == ["Portfolio"]


def test_goal_trash_view_and_restore(client: TestClient) -> None:
    goal = post(client, GOALS, title="Internship")
    client.delete(f"{GOALS}/{goal['id']}")

    assert [g["title"] for g in client.get(GOALS, params={"view": "trash"}).json()] == [
        "Internship"
    ]
    assert client.get(f"{GOALS}/{goal['id']}").status_code == 404
    assert client.post(f"{GOALS}/{goal['id']}/restore").status_code == 200
    assert client.get(GOALS).json()[0]["title"] == "Internship"
