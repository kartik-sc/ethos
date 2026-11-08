import os
import time
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.files import storage
from app.files.models import FileAsset
from app.files.service import ORPHAN_GRACE_SECONDS, clean_filename, sweep_orphans
from app.projects.models import Project
from app.trash.service import purge_expired

PROJECTS = "/api/v1/projects"
FILES = "/api/v1/files"


@pytest.fixture
def root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    monkeypatch.setattr(get_settings(), "file_storage_dir", tmp_path)
    yield tmp_path


def make_project(client: TestClient, title: str = "Thesis") -> str:
    response = client.post(PROJECTS, json={"title": title})
    assert response.status_code == 201, response.text
    project_id: str = response.json()["id"]
    return project_id


def upload(
    client: TestClient,
    project_id: str,
    name: str,
    body: bytes = b"hello",
    *,
    replace: bool = False,
    content_type: str = "text/plain",
) -> Any:
    return client.post(
        f"{PROJECTS}/{project_id}/files",
        params={"filename": name, "replace": replace},
        content=body,
        headers={"Content-Type": content_type},
    )


def blobs(root: Path) -> list[Path]:
    return [path for path in root.glob("??/*") if path.is_file()]


def test_upload_lists_and_downloads(client: TestClient, root: Path) -> None:
    project_id = make_project(client)

    created = upload(client, project_id, "notes.pdf", b"%PDF-1.7", content_type="application/pdf")

    assert created.status_code == 201, created.text
    body = created.json()
    assert body["filename"] == "notes.pdf"
    assert body["size_bytes"] == 8
    assert "storage_key" not in body
    listed = client.get(f"{PROJECTS}/{project_id}/files").json()
    assert [item["filename"] for item in listed] == ["notes.pdf"]

    content = client.get(f"{FILES}/{body['id']}/content")
    assert content.content == b"%PDF-1.7"
    assert content.headers["content-type"] == "application/pdf"
    assert content.headers["content-disposition"].startswith("attachment;")
    assert content.headers["x-content-type-options"] == "nosniff"


def test_blob_is_stored_under_an_opaque_key(client: TestClient, root: Path) -> None:
    project_id = make_project(client)
    upload(client, project_id, "../../etc/passwd")

    [blob] = blobs(root)
    assert "passwd" not in str(blob)
    assert blob.resolve().is_relative_to(root.resolve())
    assert client.get(f"{PROJECTS}/{project_id}/files").json()[0]["filename"] == "passwd"


def test_same_name_needs_confirmation_then_replaces(client: TestClient, root: Path) -> None:
    project_id = make_project(client)
    first = upload(client, project_id, "Draft.docx", b"one").json()

    conflict = upload(client, project_id, "draft.DOCX", b"two")

    assert conflict.status_code == 409
    assert conflict.json()["existing"]["id"] == first["id"]
    assert client.get(f"{FILES}/{first['id']}/content").content == b"one"
    assert len(blobs(root)) == 1

    replaced = upload(client, project_id, "draft.DOCX", b"two!", replace=True)

    assert replaced.status_code == 201
    assert replaced.json()["id"] == first["id"]
    assert replaced.json()["filename"] == "draft.DOCX"
    assert client.get(f"{FILES}/{first['id']}/content").content == b"two!"
    assert len(blobs(root)) == 1, "the replaced blob is removed"


def test_same_name_in_another_project_is_fine(client: TestClient, root: Path) -> None:
    upload(client, make_project(client, "A"), "plan.md")
    assert upload(client, make_project(client, "B"), "plan.md").status_code == 201


def test_over_25_mb_is_rejected_and_leaves_nothing(
    client: TestClient, root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(storage, "MAX_BYTES", 10)
    project_id = make_project(client)

    response = upload(client, project_id, "big.bin", b"x" * 11)

    assert response.status_code == 413
    assert client.get(f"{PROJECTS}/{project_id}/files").json() == []
    assert list(root.rglob("*.*")) == [] and blobs(root) == []


def test_upload_to_missing_or_trashed_project_is_404(client: TestClient, root: Path) -> None:
    project_id = make_project(client)
    client.delete(f"{PROJECTS}/{project_id}")
    assert upload(client, project_id, "a.txt").status_code == 404
    assert blobs(root) == []


def test_rename_refuses_a_taken_name(client: TestClient, root: Path) -> None:
    project_id = make_project(client)
    upload(client, project_id, "a.txt")
    b = upload(client, project_id, "b.txt").json()

    assert client.patch(f"{FILES}/{b['id']}", json={"filename": "A.txt"}).status_code == 409
    renamed = client.patch(f"{FILES}/{b['id']}", json={"filename": "c.txt"})
    assert renamed.json()["filename"] == "c.txt"


def test_trash_and_restore_a_file(client: TestClient, root: Path) -> None:
    project_id = make_project(client)
    file_id = upload(client, project_id, "a.txt").json()["id"]

    assert client.delete(f"{FILES}/{file_id}").status_code == 204
    assert client.get(f"{PROJECTS}/{project_id}/files").json() == []
    assert client.get(f"{FILES}/{file_id}/content").status_code == 404
    trashed = client.get(f"{PROJECTS}/{project_id}/files", params={"view": "trash"}).json()
    assert [item["id"] for item in trashed] == [file_id]

    upload(client, project_id, "a.txt", b"newer")
    assert client.post(f"{FILES}/{file_id}/restore").status_code == 409, "name now taken"


def test_files_travel_with_their_project(client: TestClient, root: Path) -> None:
    project_id = make_project(client)
    kept = upload(client, project_id, "kept.txt").json()
    earlier = upload(client, project_id, "earlier.txt").json()
    client.delete(f"{FILES}/{earlier['id']}")

    client.delete(f"{PROJECTS}/{project_id}")
    assert client.post(f"{FILES}/{kept['id']}/restore").status_code == 409

    client.post(f"{PROJECTS}/{project_id}/restore")
    live = client.get(f"{PROJECTS}/{project_id}/files").json()
    assert [item["filename"] for item in live] == ["kept.txt"]


def test_purge_then_sweep_removes_expired_blobs(
    client: TestClient, session: Session, root: Path
) -> None:
    project_id = make_project(client)
    upload(client, project_id, "a.txt")
    upload(client, project_id, "b.txt")
    client.delete(f"{PROJECTS}/{project_id}")
    old = datetime.now(UTC) - timedelta(days=31)
    for model in (Project, FileAsset):
        session.execute(update(model).values(deleted_at=old))
    session.commit()

    purged = purge_expired(session, datetime.now(UTC))

    assert purged.files == 2 and purged.projects == 1
    assert session.scalars(select(FileAsset)).all() == []
    later = time.time() + ORPHAN_GRACE_SECONDS + 1
    assert sweep_orphans(session, root, now=later) == 2
    assert blobs(root) == []


def test_sweep_spares_recent_and_referenced_blobs(
    client: TestClient, session: Session, root: Path
) -> None:
    project_id = make_project(client)
    upload(client, project_id, "kept.txt")
    stray = root / "ab" / ("ab" + "0" * 30)
    stray.parent.mkdir(parents=True, exist_ok=True)
    stray.write_bytes(b"in flight")

    assert sweep_orphans(session, root) == 0
    past = time.time() - ORPHAN_GRACE_SECONDS - 1
    os.utime(stray, (past, past))
    assert sweep_orphans(session, root) == 1
    assert len(blobs(root)) == 1


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("report.pdf", "report.pdf"),
        ("C:\\Users\\me\\report.pdf", "report.pdf"),
        ("  ..hidden  ", "hidden"),
        ('bad<>:"|?*name.txt', "badname.txt"),
        ("a" * 300 + ".pdf", "a" * 196 + ".pdf"),
    ],
)
def test_clean_filename(raw: str, expected: str) -> None:
    assert clean_filename(raw) == expected


def test_empty_filename_is_rejected(client: TestClient, root: Path) -> None:
    assert upload(client, make_project(client), "../..").status_code == 422
