from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.core.clock import local_today

TODAY = local_today(datetime.now(UTC), "Asia/Kolkata")


def due(days: int) -> str:
    return str(TODAY + timedelta(days=days))


def test_radar_covers_overdue_and_the_next_thirty_days(client: TestClient) -> None:
    project = client.post("/api/v1/projects", json={"title": "Portfolio", "due_date": due(20)})
    client.post(
        "/api/v1/tasks",
        json={"title": "Deploy", "due_date": due(3), "project_id": project.json()["id"]},
    )
    client.post("/api/v1/tasks", json={"title": "Overdue", "due_date": due(-2)})
    client.post("/api/v1/tasks", json={"title": "Too far", "due_date": due(45)})
    client.post("/api/v1/tasks", json={"title": "Undated"})
    client.post("/api/v1/goals", json={"title": "Internship", "target_date": due(30)})
    done = client.post("/api/v1/tasks", json={"title": "Done", "due_date": due(1)}).json()
    client.patch(f"/api/v1/tasks/{done['id']}", json={"status": "done"})

    radar = client.get("/api/v1/dashboard").json()["deadlines"]

    assert [(item["kind"], item["title"], item["days"]) for item in radar] == [
        ("task", "Overdue", -2),
        ("task", "Deploy", 3),
        ("project", "Portfolio", 20),
        ("goal", "Internship", 30),
    ]
    assert radar[1]["context"] == "Portfolio"


def test_task_counts(client: TestClient) -> None:
    client.post("/api/v1/tasks", json={"title": "Open"})
    client.post("/api/v1/tasks", json={"title": "Late", "due_date": due(-1)})
    finished = client.post("/api/v1/tasks", json={"title": "Finished"}).json()
    client.patch(f"/api/v1/tasks/{finished['id']}", json={"status": "done"})

    counts = client.get("/api/v1/dashboard").json()["tasks"]

    assert counts == {"open": 2, "overdue": 1, "done_today": 1, "done_this_week": 1}
