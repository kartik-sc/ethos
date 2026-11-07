import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.notes import service
from app.notes.models import Folder, Note
from app.notes.schemas import (
    FolderCreate,
    FolderRead,
    FolderUpdate,
    LinkTarget,
    NoteCreate,
    NoteRead,
    NoteSave,
    NoteSummary,
    NoteTree,
    VersionRead,
    VersionSummary,
)

router = APIRouter(tags=["notes"])

SessionDep = Annotated[Session, Depends(get_session)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Not found"}}
CONFLICT: dict[int | str, dict[str, Any]] = {
    409: {"description": "Rule broken, or (on save) the note changed since it was loaded"}
}


@contextmanager
def _rules() -> Iterator[None]:
    try:
        yield
    except service.NotesError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, error.message) from None


def _note(session: Session, note_id: uuid.UUID, *, trashed: bool = False) -> Note:
    try:
        return service.get_note(session, note_id, trashed=trashed)
    except service.NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found") from None


def _folder(session: Session, folder_id: uuid.UUID) -> Folder:
    folder = session.get(Folder, folder_id)
    if folder is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
    return folder


# Folders


@router.post("/note-folders", status_code=status.HTTP_201_CREATED, responses=CONFLICT)
def create_folder(data: FolderCreate, session: SessionDep) -> FolderRead:
    with _rules():
        return FolderRead.model_validate(service.create_folder(session, data))


@router.patch("/note-folders/{folder_id}", responses={**NOT_FOUND, **CONFLICT})
def update_folder(folder_id: uuid.UUID, data: FolderUpdate, session: SessionDep) -> FolderRead:
    with _rules():
        return FolderRead.model_validate(
            service.update_folder(session, _folder(session, folder_id), data)
        )


@router.delete(
    "/note-folders/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
)
def delete_folder(folder_id: uuid.UUID, session: SessionDep) -> None:
    with _rules():
        service.delete_folder(session, _folder(session, folder_id))


# Notes


@router.get("/notes/tree")
def note_tree(session: SessionDep) -> NoteTree:
    return service.tree(session)


@router.get("/notes/trash")
def trashed_notes(session: SessionDep) -> list[NoteSummary]:
    return [service.summarize(note) for note in service.trashed(session)]


@router.get("/notes/link-targets")
def link_targets(
    session: SessionDep, q: Annotated[str, Query(max_length=220)] = ""
) -> list[LinkTarget]:
    return service.link_targets(session, q)


@router.post("/notes", status_code=status.HTTP_201_CREATED, responses=CONFLICT)
def create_note(data: NoteCreate, session: SessionDep) -> NoteRead:
    with _rules():
        note = service.create_note(session, data, datetime.now(UTC))
    return service.read(session, note)


@router.get("/notes/{note_id}", responses=NOT_FOUND)
def get_note(note_id: uuid.UUID, session: SessionDep) -> NoteRead:
    return service.read(session, _note(session, note_id))


@router.put("/notes/{note_id}", responses={**NOT_FOUND, **CONFLICT})
def save_note(note_id: uuid.UUID, data: NoteSave, session: SessionDep) -> Any:
    """Saves, merging with a newer version when `base` is sent and the edits don't overlap.

    409 with `{"detail", "current", "merged_with_markers"}` when they do (or `base` is missing).
    """
    note = _note(session, note_id)
    try:
        with _rules():
            note, merged = service.save_note(session, note, data, datetime.now(UTC))
    except service.StaleSaveError as stale:
        current = service.read(session, stale.current)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=jsonable_encoder(
                {
                    "detail": "This note changed since you opened it",
                    "current": current,
                    "merged_with_markers": stale.with_markers,
                }
            ),
        )
    return service.read(session, note).model_copy(update={"merged": merged})


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def trash_note(note_id: uuid.UUID, session: SessionDep) -> None:
    service.trash_note(session, _note(session, note_id), datetime.now(UTC))


@router.post("/notes/{note_id}/restore", responses={**NOT_FOUND, **CONFLICT})
def restore_note(note_id: uuid.UUID, session: SessionDep) -> NoteRead:
    with _rules():
        note = service.restore_note(session, _note(session, note_id, trashed=True))
    return service.read(session, note)


@router.get("/notes/{note_id}/versions", responses=NOT_FOUND)
def note_versions(note_id: uuid.UUID, session: SessionDep) -> list[VersionSummary]:
    return service.versions(session, _note(session, note_id))


@router.get("/notes/{note_id}/versions/{version_id}", responses=NOT_FOUND)
def note_version(note_id: uuid.UUID, version_id: uuid.UUID, session: SessionDep) -> VersionRead:
    try:
        version = service.get_version(session, _note(session, note_id), version_id)
    except service.NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Version not found") from None
    return VersionRead(
        id=version.id,
        title=version.title,
        saved_at=version.saved_at,
        length=len(version.content),
        content=version.content,
    )
