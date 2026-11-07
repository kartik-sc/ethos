from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.goals.models import Goal
from app.habits.models import Habit, HabitLog
from app.projects.models import Project
from app.tasks.models import Task
from app.trash.service import purge_expired

NOW = datetime.now(UTC)


def backdate(session: Session, model: type[Task | Project | Goal | Habit], days: int) -> None:
    trashed = model.deleted_at.is_not(None)
    session.execute(update(model).where(trashed).values(deleted_at=NOW - timedelta(days=days)))
    session.commit()


def test_purge_removes_only_records_older_than_thirty_days(
    client: TestClient, session: Session
) -> None:
    old = client.post("/api/v1/tasks", json={"title": "old"}).json()
    recent = client.post("/api/v1/tasks", json={"title": "recent"}).json()
    client.delete(f"/api/v1/tasks/{old['id']}")
    client.delete(f"/api/v1/tasks/{recent['id']}")
    session.execute(
        update(Task).where(Task.title == "old").values(deleted_at=NOW - timedelta(days=31))
    )
    session.commit()

    purged = purge_expired(session, NOW)

    assert purged.tasks == 1
    assert session.scalars(select(Task.title)).all() == ["recent"]


def test_purging_a_project_takes_its_tasks_and_a_goal_only_unlinks(
    client: TestClient, session: Session
) -> None:
    goal = client.post("/api/v1/goals", json={"title": "Goal"}).json()
    project = client.post("/api/v1/projects", json={"title": "P", "goal_id": goal["id"]}).json()
    client.post("/api/v1/tasks", json={"title": "in project", "project_id": project["id"]})
    keeper = client.post("/api/v1/projects", json={"title": "Keeper", "goal_id": goal["id"]})
    client.delete(f"/api/v1/projects/{project['id']}")
    client.delete(f"/api/v1/goals/{goal['id']}")
    backdate(session, Project, 40)
    backdate(session, Goal, 40)
    backdate(session, Task, 40)

    purged = purge_expired(session, NOW)

    assert (purged.projects, purged.goals) == (1, 1)
    assert session.scalars(select(Task)).all() == []
    survivor = session.get(Project, keeper.json()["id"])
    assert survivor is not None and survivor.goal_id is None


def test_purging_a_habit_removes_its_logs(client: TestClient, session: Session) -> None:
    habit = client.post(
        "/api/v1/habits", json={"title": "Read", "cadence": "weekly", "times_per_week": 2}
    ).json()
    today = habit["summary"]["today"]["date"]
    client.put(f"/api/v1/habits/{habit['id']}/logs/{today}", json={})
    client.delete(f"/api/v1/habits/{habit['id']}")
    backdate(session, Habit, 31)

    assert purge_expired(session, NOW).habits == 1
    assert session.scalars(select(HabitLog)).all() == []


def test_closed_tasks_move_from_done_to_archived(client: TestClient, session: Session) -> None:
    for title in ("recent", "old"):
        task = client.post("/api/v1/tasks", json={"title": title}).json()
        client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "done"})
    session.execute(
        update(Task).where(Task.title == "old").values(completed_at=NOW - timedelta(days=45))
    )
    session.commit()

    done = [t["title"] for t in client.get("/api/v1/tasks", params={"view": "done"}).json()]
    archived = [t["title"] for t in client.get("/api/v1/tasks", params={"view": "archived"}).json()]
    assert (done, archived) == (["recent"], ["old"])

    client.patch("/api/v1/preferences", json={"archive_after_days": 60})
    done = [t["title"] for t in client.get("/api/v1/tasks", params={"view": "done"}).json()]
    assert done == ["recent", "old"]


def test_preferences_defaults_and_validation(client: TestClient) -> None:
    assert client.get("/api/v1/preferences").json() == {"archive_after_days": 30}
    assert client.patch("/api/v1/preferences", json={"archive_after_days": 0}).status_code == 422
