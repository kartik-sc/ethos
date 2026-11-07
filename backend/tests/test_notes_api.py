from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.notes.models import NoteVersion

NOTES = "/api/v1/notes"
FOLDERS = "/api/v1/note-folders"


def create(client: TestClient, title: str, **fields: Any) -> dict[str, Any]:
    response = client.post(NOTES, json={"title": title, **fields})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def save(client: TestClient, note: dict[str, Any], **changes: Any) -> Any:
    body = {
        "title": note["title"],
        "content": note["content"],
        "folder_id": note["folder_id"],
        "tags": note["tags"],
        "base_version": note["version"],
        **changes,
    }
    return client.put(f"{NOTES}/{note['id']}", json=body)


def test_create_normalises_tags_and_starts_at_version_one(client: TestClient) -> None:
    note = create(client, "Graph theory", content="BFS and DFS", tags=["#CS", "algorithms", "cs"])
    assert note["tags"] == ["algorithms", "cs"]
    assert note["version"] == 1


def test_titles_are_unique_ignoring_case(client: TestClient) -> None:
    create(client, "Graph theory")
    response = client.post(NOTES, json={"title": "graph THEORY"})
    assert response.status_code == 409
    assert response.json()["detail"] == "Another note already has this title"


def test_saving_bumps_the_version_and_a_stale_save_is_refused(client: TestClient) -> None:
    note = create(client, "Draft", content="v1")
    saved = save(client, note, content="v2")
    assert saved.status_code == 200
    assert saved.json()["version"] == 2

    stale = save(client, note, content="written from another tab")
    assert stale.status_code == 409
    body = stale.json()
    assert body["detail"] == "This note changed since you opened it"
    assert body["current"]["content"] == "v2"
    assert client.get(f"{NOTES}/{note['id']}").json()["content"] == "v2"


def test_wiki_links_resolve_backlink_and_survive_a_rename(client: TestClient) -> None:
    target = create(client, "Graph theory")
    source = create(client, "Algorithms", content="See [[Graph theory]] and [[Missing note]].")

    links = {link["label"]: link for link in source["links"]}
    assert links["Graph theory"]["resolved"] is True
    assert links["Missing note"]["resolved"] is False
    assert client.get(f"{NOTES}/{target['id']}").json()["backlinks"] == [
        {"id": source["id"], "title": "Algorithms"}
    ]

    renamed = save(client, client.get(f"{NOTES}/{target['id']}").json(), title="Graphs")
    assert renamed.status_code == 200
    source_now = client.get(f"{NOTES}/{source['id']}").json()
    link = next(link for link in source_now["links"] if link["label"] == "Graph theory")
    assert (link["resolved"], link["target_title"]) == (True, "Graphs")


def test_a_note_created_later_claims_dangling_links(client: TestClient) -> None:
    source = create(client, "Index", content="[[Future note]]")
    create(client, "Future note")
    link = client.get(f"{NOTES}/{source['id']}").json()["links"][0]
    assert link["resolved"] is True


def test_contextual_links_to_records(client: TestClient) -> None:
    task = client.post("/api/v1/tasks", json={"title": "Revise OS"}).json()
    note = create(client, "Plan", content="Next: [[task:Revise OS]]")
    link = note["links"][0]
    assert (link["kind"], link["target_id"], link["resolved"]) == ("task", task["id"], True)


def test_link_targets_autocomplete(client: TestClient) -> None:
    create(client, "Graph theory")
    create(client, "Graphs in practice")
    client.post("/api/v1/projects", json={"title": "Graph visualiser"})

    notes = client.get(f"{NOTES}/link-targets", params={"q": "graph"}).json()
    assert [target["title"] for target in notes] == ["Graph theory", "Graphs in practice"]
    projects = client.get(f"{NOTES}/link-targets", params={"q": "project:graph"}).json()
    assert [(t["kind"], t["title"]) for t in projects] == [("project", "Graph visualiser")]


def test_close_saves_share_one_version_and_old_ones_are_kept(
    client: TestClient, session: Session
) -> None:
    note = create(client, "Journal-ish", content="one")
    note = save(client, note, content="two").json()
    assert len(client.get(f"{NOTES}/{note['id']}/versions").json()) == 1

    session.execute(update(NoteVersion).values(saved_at=datetime.now(UTC) - timedelta(minutes=30)))
    session.commit()
    save(client, note, content="three")

    versions = client.get(f"{NOTES}/{note['id']}/versions").json()
    assert len(versions) == 2
    oldest = client.get(f"{NOTES}/{note['id']}/versions/{versions[-1]['id']}").json()
    assert oldest["content"] == "two"
    assert session.scalars(select(NoteVersion)).all()


def test_folders_nest_without_cycles_and_only_empty_ones_delete(client: TestClient) -> None:
    cs = client.post(FOLDERS, json={"name": "CS"}).json()
    algo = client.post(FOLDERS, json={"name": "Algorithms", "parent_id": cs["id"]}).json()
    assert client.post(FOLDERS, json={"name": "cs"}).status_code == 409

    cycle = client.patch(f"{FOLDERS}/{cs['id']}", json={"parent_id": algo["id"]})
    assert cycle.status_code == 409

    create(client, "Sorting", folder_id=algo["id"])
    assert client.delete(f"{FOLDERS}/{algo['id']}").status_code == 409

    tree = client.get(f"{NOTES}/tree").json()
    assert {f["name"] for f in tree["folders"]} == {"CS", "Algorithms"}
    assert tree["notes"][0]["folder_id"] == algo["id"]


def test_trash_and_restore_respects_title_uniqueness(client: TestClient) -> None:
    note = create(client, "Scratch")
    assert client.delete(f"{NOTES}/{note['id']}").status_code == 204
    assert [n["title"] for n in client.get(f"{NOTES}/trash").json()] == ["Scratch"]

    create(client, "Scratch")
    assert client.post(f"{NOTES}/{note['id']}/restore").status_code == 409


def test_tree_lists_tags_in_use(client: TestClient) -> None:
    create(client, "A", tags=["dbms"])
    gone = create(client, "B", tags=["old"])
    client.delete(f"{NOTES}/{gone['id']}")
    assert client.get(f"{NOTES}/tree").json()["tags"] == ["dbms"]


def test_keeping_mine_after_a_conflict_preserves_theirs_in_history(client: TestClient) -> None:
    mine = create(client, "Shared", content="original")
    theirs = save(client, mine, content="their edit").json()

    assert save(client, mine, content="my edit").status_code == 409
    kept = save(
        client, mine, content="my edit", base_version=theirs["version"], preserve_current=True
    )

    assert kept.status_code == 200
    contents = [
        client.get(f"{NOTES}/{mine['id']}/versions/{version['id']}").json()["content"]
        for version in client.get(f"{NOTES}/{mine['id']}/versions").json()
    ]
    assert contents == ["my edit", "their edit"]
