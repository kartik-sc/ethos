import pytest
from fastapi.testclient import TestClient

from app.notes.transfer import free_title, safe_filename, split_path, title_from_filename

NOTES = "/api/v1/notes"
FOLDERS = "/api/v1/note-folders"


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("Sorting.md", ([], "Sorting.md")),
        ("CS\\Algorithms\\Sorting.md", (["CS", "Algorithms"], "Sorting.md")),
        ("./CS/../Sorting.md", (["CS"], "Sorting.md")),
        ("  /  ", None),
    ],
)
def test_split_path(path: str, expected: tuple[list[str], str] | None) -> None:
    assert split_path(path) == expected


def test_titles_and_filenames() -> None:
    assert title_from_filename("Graph Theory.MD") == "Graph Theory"
    assert title_from_filename("notes.markdown") == "notes"
    assert title_from_filename("image.png") is None
    assert title_from_filename(".md") is None
    assert free_title("Plan", {"plan", "plan (2)"}) == "Plan (3)"
    assert safe_filename('A/B: "x"?') == "A-B- -x-.md"


def test_import_recreates_folders_and_links_between_files(client: TestClient) -> None:
    existing = client.post(NOTES, json={"title": "Index"}).json()
    response = client.post(
        f"{NOTES}/import",
        json={
            "files": [
                {"path": "Vault/CS/Graphs.md", "content": "See [[Sorting]]"},
                {"path": "Vault/CS/Sorting.md", "content": "# Sorting"},
                {"path": "Vault/Index.md", "content": "duplicate title"},
                {"path": "Vault/photo.png", "content": "binary"},
            ]
        },
    )

    assert response.status_code == 200, response.text
    result = response.json()
    assert [note["title"] for note in result["created"]] == ["Graphs", "Sorting", "Index (2)"]
    assert result["renamed"] == [{"path": "Vault/Index.md", "title": "Index (2)"}]
    assert result["skipped"] == [{"path": "Vault/photo.png", "reason": "Not a Markdown file"}]
    assert result["folders_created"] == 2

    graphs = client.get(f"{NOTES}/{result['created'][0]['id']}").json()
    assert graphs["links"][0]["resolved"] is True
    tree = client.get(f"{NOTES}/tree").json()
    assert {(f["name"], f["parent_id"] is None) for f in tree["folders"]} == {
        ("Vault", True),
        ("CS", False),
    }
    assert existing["title"] == "Index"


def test_import_into_a_folder_reuses_existing_subfolders(client: TestClient) -> None:
    root = client.post(FOLDERS, json={"name": "Inbox notes"}).json()
    client.post(FOLDERS, json={"name": "Week 1", "parent_id": root["id"]})

    result = client.post(
        f"{NOTES}/import",
        json={"folder_id": root["id"], "files": [{"path": "week 1/Plan.md", "content": ""}]},
    ).json()

    assert result["folders_created"] == 0
    note = client.get(f"{NOTES}/{result['created'][0]['id']}").json()
    folder_names = {f["id"]: f["name"] for f in client.get(f"{NOTES}/tree").json()["folders"]}
    assert folder_names[note["folder_id"]] == "Week 1"


def test_export_round_trips_paths(client: TestClient) -> None:
    client.post(
        f"{NOTES}/import",
        json={
            "files": [
                {"path": "CS/Graphs.md", "content": "graphs"},
                {"path": "CS/Algorithms/Sorting.md", "content": "sorting"},
            ]
        },
    )
    cs = next(f for f in client.get(f"{NOTES}/tree").json()["folders"] if f["name"] == "CS")

    files = client.get(f"{FOLDERS}/{cs['id']}/export").json()

    assert sorted((f["path"], f["content"]) for f in files) == [
        ("CS/Algorithms/Sorting.md", "sorting"),
        ("CS/Graphs.md", "graphs"),
    ]


def test_import_limits(client: TestClient) -> None:
    too_many = [{"path": f"{n}.md", "content": ""} for n in range(501)]
    assert client.post(f"{NOTES}/import", json={"files": too_many}).status_code == 422
    assert client.post(f"{NOTES}/import", json={"files": []}).status_code == 422
