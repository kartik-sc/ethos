"""Markdown import and folder export. Files are plain Markdown; nothing else is promised."""

import re
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.notes.models import Folder, Note
from app.notes.schemas import (
    ExportFile,
    ImportRenamed,
    ImportRequest,
    ImportResult,
    ImportSkipped,
    NoteRef,
)
from app.notes.service import (
    claim_dangling_links,
    ensure_folder,
    snapshot,
    sync_links,
)

MARKDOWN_SUFFIXES = (".md", ".markdown")
TITLE_LIMIT = 200
FOLDER_NAME_LIMIT = 120
UNSAFE_FILENAME = re.compile(r'[\\/:*?"<>|]+')


def split_path(path: str) -> tuple[list[str], str] | None:
    """Folder names and the file name, ignoring empty, "." and ".." segments."""
    parts = [
        part.strip()
        for part in path.replace("\\", "/").split("/")
        if part.strip() and part.strip() not in (".", "..")
    ]
    if not parts:
        return None
    return parts[:-1], parts[-1]


def title_from_filename(filename: str) -> str | None:
    lowered = filename.lower()
    suffix = next((s for s in MARKDOWN_SUFFIXES if lowered.endswith(s)), None)
    if suffix is None:
        return None
    return filename[: -len(suffix)].strip()[:TITLE_LIMIT] or None


def free_title(title: str, taken: set[str]) -> str:
    """The title itself, or "Title (2)", "Title (3)"… when it is already in use."""
    if title.lower() not in taken:
        return title
    for n in range(2, 10_000):
        suffix = f" ({n})"
        candidate = title[: TITLE_LIMIT - len(suffix)] + suffix
        if candidate.lower() not in taken:
            return candidate
    raise RuntimeError("no free title")  # pragma: no cover


def _child_folder(
    session: Session, parent_id: uuid.UUID | None, name: str, created: list[Folder]
) -> Folder:
    name = name[:FOLDER_NAME_LIMIT]
    existing = session.scalars(
        select(Folder).where(
            Folder.parent_id.is_(None) if parent_id is None else Folder.parent_id == parent_id,
            func.lower(Folder.name) == name.lower(),
        )
    ).first()
    if existing is not None:
        return existing
    folder = Folder(name=name, parent_id=parent_id)
    session.add(folder)
    session.flush()
    created.append(folder)
    return folder


def import_markdown(session: Session, request: ImportRequest, now: datetime) -> ImportResult:
    """Creates a note per Markdown file in one transaction, recreating folders from paths."""
    ensure_folder(session, request.folder_id)
    taken = {
        title.lower()
        for title in session.scalars(select(Note.title).where(Note.deleted_at.is_(None)))
    }
    notes: list[Note] = []
    renamed: list[ImportRenamed] = []
    skipped: list[ImportSkipped] = []
    folders: list[Folder] = []

    for file in request.files:
        split = split_path(file.path)
        if split is None:
            skipped.append(ImportSkipped(path=file.path, reason="Empty path"))
            continue
        folder_names, filename = split
        wanted = title_from_filename(filename)
        if wanted is None:
            skipped.append(ImportSkipped(path=file.path, reason="Not a Markdown file"))
            continue

        parent_id = request.folder_id
        for name in folder_names:
            parent_id = _child_folder(session, parent_id, name, folders).id

        title = free_title(wanted, taken)
        taken.add(title.lower())
        if title != wanted:
            renamed.append(ImportRenamed(path=file.path, title=title))

        note = Note(
            title=title,
            content=file.content,
            folder_id=parent_id,
            tags=[],
            created_at=now,
            updated_at=now,
        )
        session.add(note)
        session.flush()
        sync_links(session, note)
        snapshot(session, note, now)
        notes.append(note)

    # Links between imported files resolve whichever order the files arrived in.
    for note in notes:
        claim_dangling_links(session, note)
    session.commit()
    return ImportResult(
        created=[NoteRef(id=note.id, title=note.title) for note in notes],
        renamed=renamed,
        skipped=skipped,
        folders_created=len(folders),
    )


def safe_filename(title: str) -> str:
    return (UNSAFE_FILENAME.sub("-", title).strip() or "note") + ".md"


def export_folder(session: Session, folder: Folder) -> list[ExportFile]:
    """Every live note in the folder and its subfolders, at paths under the folder's name."""
    children: dict[uuid.UUID | None, list[Folder]] = {}
    for candidate in session.scalars(select(Folder)):
        children.setdefault(candidate.parent_id, []).append(candidate)

    paths: dict[uuid.UUID, str] = {}
    pending = [(folder, folder.name)]
    while pending:
        current, path = pending.pop()
        paths[current.id] = path
        pending += [(child, f"{path}/{child.name}") for child in children.get(current.id, [])]

    notes = session.scalars(
        select(Note)
        .where(Note.folder_id.in_(paths), Note.deleted_at.is_(None))
        .order_by(func.lower(Note.title))
    ).all()
    files: list[ExportFile] = []
    used: set[str] = set()
    for note in notes:
        base = f"{paths[note.folder_id]}/{safe_filename(note.title)}" if note.folder_id else ""
        path, n = base, 2
        while path.lower() in used:
            path = base.removesuffix(".md") + f" ({n}).md"
            n += 1
        used.add(path.lower())
        files.append(ExportFile(path=path, content=note.content))
    return files
