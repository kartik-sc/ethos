from typing import Any

from fastapi.testclient import TestClient

PROJECTS = "/api/v1/projects"
TASKS = "/api/v1/tasks"


def create_project(client: TestClient, **fields: Any) -> dict[str, Any]:
    response = client.post(PROJECTS, json={"title": "Portfolio site", **fields})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def create_task(client: TestClient, title: str, **fields: Any) -> dict[str, Any]:
    response = client.post(TASKS, json={"title": title, **fields})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_new_project_has_no_tasks(client: TestClient) -> None:
    project = create_project(client, area="career")
    assert project["tasks"] == {"open": 0, "done": 0, "next_due": None}
    assert project["area"] == "career"


def test_counts_and_next_due_come_from_live_tasks(client: TestClient) -> None:
    project = create_project(client)
    create_task(client, "Design", project_id=project["id"], due_date="2026-12-01")
    create_task(client, "Build", project_id=project["id"], due_date="2026-11-20")
    done = create_task(client, "Domain", project_id=project["id"])
    client.patch(f"{TASKS}/{done['id']}", json={"status": "done"})
    trashed = create_task(client, "Old idea", project_id=project["id"])
    client.delete(f"{TASKS}/{trashed['id']}")

    counts = client.get(f"{PROJECTS}/{project['id']}").json()["tasks"]
    assert counts == {"open": 2, "done": 1, "next_due": "2026-11-20"}


def test_task_carries_its_project_reference(client: TestClient) -> None:
    project = create_project(client)
    task = create_task(client, "Write copy", project_id=project["id"])
    assert task["project"] == {"id": project["id"], "title": "Portfolio site"}

    listed = client.get(TASKS, params={"project_id": project["id"]}).json()
    assert [item["title"] for item in listed] == ["Write copy"]


def test_task_cannot_link_to_missing_or_trashed_project(client: TestClient) -> None:
    missing = "00000000-0000-7000-8000-000000000000"
    assert client.post(TASKS, json={"title": "x", "project_id": missing}).status_code == 422

    project = create_project(client)
    client.delete(f"{PROJECTS}/{project['id']}")
    assert client.post(TASKS, json={"title": "x", "project_id": project["id"]}).status_code == 422


def test_deleting_a_project_moves_its_tasks_to_trash_together(client: TestClient) -> None:
    project = create_project(client)
    create_task(client, "Design", project_id=project["id"])
    create_task(client, "Unrelated")

    response = client.delete(f"{PROJECTS}/{project['id']}")

    assert response.json() == {"tasks_moved": 1}
    assert [task["title"] for task in client.get(TASKS).json()] == ["Unrelated"]
    assert [p["title"] for p in client.get(PROJECTS, params={"view": "trash"}).json()] == [
        "Portfolio site"
    ]
    assert client.get(f"{PROJECTS}/{project['id']}").status_code == 404


def test_restore_brings_back_only_tasks_deleted_with_the_project(client: TestClient) -> None:
    project = create_project(client)
    create_task(client, "Design", project_id=project["id"])
    earlier = create_task(client, "Dropped earlier", project_id=project["id"])
    client.delete(f"{TASKS}/{earlier['id']}")
    client.delete(f"{PROJECTS}/{project['id']}")

    restored = client.post(f"{PROJECTS}/{project['id']}/restore")

    assert restored.status_code == 200
    assert restored.json()["tasks"]["open"] == 1
    open_titles = [task["title"] for task in client.get(TASKS).json()]
    assert open_titles == ["Design"]
    trash_titles = [task["title"] for task in client.get(TASKS, params={"view": "trash"}).json()]
    assert trash_titles == ["Dropped earlier"]


def test_task_from_trashed_project_cannot_be_restored_alone(client: TestClient) -> None:
    project = create_project(client)
    task = create_task(client, "Design", project_id=project["id"])
    client.delete(f"{PROJECTS}/{project['id']}")

    response = client.post(f"{TASKS}/{task['id']}/restore")

    assert response.status_code == 409
    assert response.json()["detail"] == "Restore its project first"


def test_partial_update(client: TestClient) -> None:
    project = create_project(client, description="Personal site")
    response = client.patch(f"{PROJECTS}/{project['id']}", json={"due_date": "2026-12-31"})
    body = response.json()
    assert body["due_date"] == "2026-12-31"
    assert body["description"] == "Personal site"
    assert client.patch(f"{PROJECTS}/{project['id']}", json={"title": None}).status_code == 422
