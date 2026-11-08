"""Web clips from the browser extension. A clip is an ordinary Markdown note whose header keeps
the source URL and page metadata; it goes to Notes, never the Inbox."""

import uuid
from datetime import datetime
from urllib.parse import urlsplit

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.integrations.schemas import ClipFolder, ClipFolders, ClipRequest
from app.notes import service as notes
from app.notes.models import Folder, Note
from app.notes.schemas import NoteCreate
from app.notes.transfer import free_title

CLIP_FOLDER = "Clippings"


def _folder_paths(session: Session) -> dict[uuid.UUID, str]:
    folders = {folder.id: folder for folder in session.scalars(select(Folder)).all()}

    def path(folder: Folder) -> str:
        parent = folders.get(folder.parent_id) if folder.parent_id else None
        return f"{path(parent)}/{folder.name}" if parent else folder.name

    return {folder_id: path(folder) for folder_id, folder in folders.items()}


def _clippings(session: Session) -> Folder | None:
    return session.scalars(
        select(Folder).where(
            Folder.parent_id.is_(None), func.lower(Folder.name) == CLIP_FOLDER.lower()
        )
    ).first()


def folders(session: Session) -> ClipFolders:
    paths = _folder_paths(session)
    suggested = _clippings(session)
    return ClipFolders(
        suggested_id=suggested.id if suggested else None,
        suggested_name=CLIP_FOLDER,
        folders=[
            ClipFolder(id=folder_id, path=path)
            for folder_id, path in sorted(paths.items(), key=lambda item: item[1].lower())
        ],
    )


def _quote(text: str) -> str:
    return "\n".join(f"> {line}".rstrip() for line in text.strip().splitlines())


def render(data: ClipRequest, clipped_on: datetime) -> str:
    """The note body: a quoted source header, the owner's note, then the page itself."""
    source = data.site_name or urlsplit(str(data.url)).hostname or str(data.url)
    kind = "Selection from" if data.selection else "Clipped from"
    header = [f"{kind} [{source}]({data.url}) on {clipped_on.day} {clipped_on:%b %Y}"]
    details = [
        f"{label}: {value}"
        for label, value in (("By", data.author), ("Published", data.published))
        if value
    ]
    if details:
        header.append(" · ".join(details))
    if data.description:
        header.extend(["", data.description])
    parts = [_quote("\n".join(header))]
    if data.note:
        parts.append(f"**Note:** {data.note.strip()}")
    parts.extend(["---", data.markdown.strip()])
    return "\n\n".join(parts) + "\n"


def clip(session: Session, data: ClipRequest, now: datetime) -> tuple[Note, str]:
    """Creates the note; returns it with its folder path. A taken title gets " (2)"."""
    folder = notes.ensure_folder(session, data.folder_id) if data.folder_id else None
    if folder is None:
        folder = _clippings(session)
        if folder is None:
            folder = Folder(name=CLIP_FOLDER)
            session.add(folder)
            session.flush()
    taken = {
        title.lower()
        for title in session.scalars(select(Note.title).where(Note.deleted_at.is_(None)))
    }
    note = notes.create_note(
        session,
        NoteCreate(
            title=free_title(data.title, taken),
            folder_id=folder.id,
            content=render(data, now),
            tags=["clipping"],
        ),
        now,
    )
    return note, _folder_paths(session)[folder.id]
