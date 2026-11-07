from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient

from app.core.clock import local_today

HABITS = "/api/v1/habits"
GOALS = "/api/v1/goals"
EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]


def today() -> date:
    return local_today(datetime.now(UTC), "Asia/Kolkata")


def create(client: TestClient, **fields: Any) -> dict[str, Any]:
    body = {"title": "Read", "cadence": "daily", "weekdays": EVERY_DAY, **fields}
    response = client.post(HABITS, json=body)
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def log(client: TestClient, habit_id: str, day: date, **fields: Any) -> dict[str, Any]:
    response = client.put(f"{HABITS}/{habit_id}/logs/{day}", json=fields)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def test_new_daily_habit_is_pending_today(client: TestClient) -> None:
    habit = create(client)
    summary = habit["summary"]
    assert summary["today"]["state"] == "pending"
    assert summary["streak"] == 0
    assert summary["streak_unit"] == "days"
    assert len(summary["recent"]) == 7


def test_schedule_and_measure_must_be_consistent(client: TestClient) -> None:
    assert client.post(HABITS, json={"title": "x", "cadence": "daily"}).status_code == 422
    assert client.post(HABITS, json={"title": "x", "cadence": "weekly"}).status_code == 422
    amount_without_unit = {
        "title": "x",
        "cadence": "weekly",
        "times_per_week": 3,
        "measure": "amount",
    }
    assert client.post(HABITS, json=amount_without_unit).status_code == 422


def test_weekly_habit_drops_weekdays_and_span_forces_hours(client: TestClient) -> None:
    gym = create(client, title="Gym", cadence="weekly", times_per_week=3)
    assert gym["weekdays"] is None
    assert gym["summary"]["week_target"] == 3

    sleep = create(client, title="Sleep", measure="span", unit="whatever")
    assert sleep["unit"] == "h"


def test_logging_today_and_backfilling_builds_a_streak(client: TestClient) -> None:
    habit = create(client)
    log(client, habit["id"], today() - timedelta(days=2))
    log(client, habit["id"], today() - timedelta(days=1))
    summary = log(client, habit["id"], today())["summary"]

    assert summary["today"]["state"] == "met"
    assert summary["streak"] == 3


def test_amount_habit_needs_an_amount_and_tracks_target(client: TestClient) -> None:
    habit = create(client, title="LeetCode", measure="amount", unit="min", target_amount=120)
    url = f"{HABITS}/{habit['id']}/logs/{today()}"

    missing = client.put(url, json={})
    assert missing.status_code == 422
    assert missing.json()["detail"] == "Enter an amount in min"

    partial = client.put(url, json={"amount": 90}).json()["summary"]
    assert partial["today"]["state"] == "partial"
    assert partial["today_log"]["amount"] == "90.00"

    met = client.put(url, json={"amount": 120, "note": "graphs"}).json()["summary"]
    assert met["today"]["state"] == "met"
    assert met["today_log"]["note"] == "graphs"


def test_sleep_span_computes_hours_across_midnight(client: TestClient) -> None:
    habit = create(client, title="Sleep", measure="span", target_amount=7)
    summary = log(client, habit["id"], today(), start_time="23:15", end_time="06:45")["summary"]
    assert summary["today_log"]["amount"] == "7.50"
    assert summary["today"]["state"] == "met"


def test_future_days_cannot_be_logged(client: TestClient) -> None:
    habit = create(client)
    tomorrow = today() + timedelta(days=1)
    assert client.put(f"{HABITS}/{habit['id']}/logs/{tomorrow}", json={}).status_code == 422


def test_deleting_an_entry_undoes_it(client: TestClient) -> None:
    habit = create(client)
    log(client, habit["id"], today())
    response = client.delete(f"{HABITS}/{habit['id']}/logs/{today()}")
    assert response.json()["summary"]["today"]["state"] == "pending"


def test_partial_update_is_validated_against_the_whole_habit(client: TestClient) -> None:
    habit = create(client)
    url = f"{HABITS}/{habit['id']}"

    assert client.patch(url, json={"cadence": "weekly"}).status_code == 422

    changed = client.patch(url, json={"cadence": "weekly", "times_per_week": 4}).json()
    assert changed["weekdays"] is None
    assert changed["times_per_week"] == 4


def test_history_returns_whole_weeks(client: TestClient) -> None:
    habit = create(client)
    log(client, habit["id"], today())
    days = client.get(f"{HABITS}/{habit['id']}/history", params={"weeks": 4}).json()

    assert len(days) == 28
    assert date.fromisoformat(days[0]["date"]).weekday() == 0
    by_date = {day["date"]: day["state"] for day in days}
    assert by_date[str(today())] == "met"


def test_goal_link_counts_habits(client: TestClient) -> None:
    goal = client.post(GOALS, json={"title": "Get fit"}).json()
    create(client, title="Gym", cadence="weekly", times_per_week=3, goal_id=goal["id"])

    assert client.get(f"{GOALS}/{goal['id']}").json()["progress"]["habits"] == 1
    linked = client.get(HABITS, params={"goal_id": goal["id"]}).json()
    assert [habit["title"] for habit in linked] == ["Gym"]


def test_protected_habits_list_first_and_trash_restore(client: TestClient) -> None:
    create(client, title="Read")
    protected = create(client, title="LeetCode", protected=True)
    assert [habit["title"] for habit in client.get(HABITS).json()] == ["LeetCode", "Read"]

    assert client.delete(f"{HABITS}/{protected['id']}").status_code == 204
    assert [habit["title"] for habit in client.get(HABITS).json()] == ["Read"]
    assert client.post(f"{HABITS}/{protected['id']}/restore").status_code == 200
