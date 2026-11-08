from datetime import datetime
from typing import Any

from fastapi.testclient import TestClient

from app.integrations.clip import render
from app.integrations.schemas import ClipRequest

CLIP = "/api/v1/clip"


def auth(client: TestClient) -> dict[str, str]:
    token = client.post("/api/v1/integration-tokens", json={"name": "Browser"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def clip(client: TestClient, headers: dict[str, str], **fields: Any) -> Any:
    body = {
        "title": "How B-trees work",
        "url": "https://example.com/btrees",
        "markdown": "# B-trees\n\nBalanced search trees.",
        **fields,
    }
    return client.post(CLIP, json=body, headers=headers)


def test_clip_becomes_a_note_in_clippings_with_its_source(client: TestClient) -> None:
    headers = auth(client)

    response = clip(client, headers, site_name="Example", note="For the DBMS exam")

    assert response.status_code == 201, response.text
    result = response.json()
    assert (result["title"], result["folder"]) == ("How B-trees work", "Clippings")
    note = client.get(f"/api/v1/notes/{result['note_id']}").json()
    assert note["content"].startswith("> Clipped from [Example](https://example.com/btrees) on ")
    assert "**Note:** For the DBMS exam" in note["content"]
    assert note["content"].rstrip().endswith("Balanced search trees.")
    assert note["tags"] == ["clipping"]
    assert client.get("/api/v1/inbox").json() == [], "clips go to Notes, not the Inbox"


def test_clips_reuse_the_folder_and_never_overwrite_a_title(client: TestClient) -> None:
    headers = auth(client)
    first = clip(client, headers).json()
    second = clip(client, headers).json()

    assert second["title"] == "How B-trees work (2)"
    folders = client.get(f"{CLIP}/folders", headers=headers).json()
    assert [folder["path"] for folder in folders["folders"]] == ["Clippings"]
    assert folders["suggested_id"] == folders["folders"][0]["id"]
    assert first["note_id"] != second["note_id"]


def test_clip_into_a_chosen_nested_folder(client: TestClient) -> None:
    headers = auth(client)
    parent = client.post("/api/v1/note-folders", json={"name": "Study"}).json()
    child = client.post(
        "/api/v1/note-folders", json={"name": "DBMS", "parent_id": parent["id"]}
    ).json()

    result = clip(client, headers, folder_id=child["id"]).json()

    assert result["folder"] == "Study/DBMS"
    folders = client.get(f"{CLIP}/folders", headers=headers).json()
    assert folders["suggested_id"] is None
    assert [f["path"] for f in folders["folders"]] == ["Study", "Study/DBMS"]


def test_unknown_folder_and_bad_url_are_rejected(client: TestClient) -> None:
    headers = auth(client)
    missing = "00000000-0000-7000-8000-000000000000"
    assert clip(client, headers, folder_id=missing).status_code == 422
    assert clip(client, headers, url="javascript:alert(1)").status_code == 422


def test_clipping_needs_a_live_token(client: TestClient) -> None:
    assert clip(client, {}).status_code == 401
    assert client.get(f"{CLIP}/folders").status_code == 401
    assert client.get("/api/v1/notes/tree").json()["notes"] == []


def test_render_keeps_metadata_and_marks_selections() -> None:
    data = ClipRequest(
        title="t",
        url="https://news.example.org/a",
        markdown="Quoted paragraph.",
        selection=True,
        author="A. Writer",
        published="2026-11-01",
        description="One-line summary\nover two lines",
    )
    body = render(data, datetime(2026, 11, 8))
    assert body == (
        "> Selection from [news.example.org](https://news.example.org/a) on 8 Nov 2026\n"
        "> By: A. Writer · Published: 2026-11-01\n"
        ">\n"
        "> One-line summary\n"
        "> over two lines\n"
        "\n---\n\nQuoted paragraph.\n"
    )
