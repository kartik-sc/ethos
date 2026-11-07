import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import cast

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.goals.models import Goal
from app.notes.models import Folder, LinkKind, Note, NoteLink, NoteVersion, Tag, note_tags
from app.notes.schemas import (
    FolderCreate,
    FolderRead,
    FolderUpdate,
    LinkRead,
    LinkTarget,
    NoteCreate,
    NoteRead,
    NoteRef,
    NoteSave,
    NoteSummary,
    NoteTree,
    VersionSummary,
)
from app.notes.text import normalize_tags, parse_links, split_label
from app.projects.models import Project
from app.tasks.models import Task

# Saves this close together update one snapshot instead of piling up autosave versions.
SNAPSHOT_WINDOW = timedelta(minutes=10)
MAX_VERSIONS = 50
TARGET_SUGGESTIONS = 8

Linkable = Note | Task | Project | Goal

RECORD_MODELS: dict[LinkKind, type[Task] | type[Project] | type[Goal]] = {
    LinkKind.TASK: Task,
    LinkKind.PROJECT: Project,
    LinkKind.GOAL: Goal,
}


class NotFoundError(Exception):
    pass


class NotesError(Exception):
    """A request that conflicts with the library's rules; the message is shown as-is."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class StaleSaveError(Exception):
    """The note changed since the editor loaded it. Nothing was written."""

    def __init__(self, current: Note) -> None:
        super().__init__("stale save")
        self.current = current


# Folders


def _folder(session: Session, folder_id: uuid.UUID | None) -> Folder | None:
    if folder_id is None:
        return None
    folder = session.get(Folder, folder_id)
    if folder is None:
        raise NotesError("Folder not found")
    return folder


def _name_taken(
    session: Session, parent_id: uuid.UUID | None, name: str, exclude: uuid.UUID | None
) -> bool:
    query = select(Folder.id).where(
        Folder.parent_id.is_(None) if parent_id is None else Folder.parent_id == parent_id,
        func.lower(Folder.name) == name.lower(),
    )
    if exclude is not None:
        query = query.where(Folder.id != exclude)
    return session.scalar(query) is not None


def create_folder(session: Session, data: FolderCreate) -> Folder:
    _folder(session, data.parent_id)
    if _name_taken(session, data.parent_id, data.name, None):
        raise NotesError("A folder with that name already exists here")
    folder = Folder(name=data.name, parent_id=data.parent_id)
    session.add(folder)
    session.commit()
    return folder


def update_folder(session: Session, folder: Folder, data: FolderUpdate) -> Folder:
    fields = data.model_dump(exclude_unset=True)
    parent_id = fields.get("parent_id", folder.parent_id)
    name = fields.get("name") or folder.name
    if "parent_id" in fields:
        ancestor = _folder(session, parent_id)
        while ancestor is not None:
            if ancestor.id == folder.id:
                raise NotesError("A folder can't move inside itself")
            ancestor = _folder(session, ancestor.parent_id)
    if _name_taken(session, parent_id, name, folder.id):
        raise NotesError("A folder with that name already exists here")
    folder.name, folder.parent_id = name, parent_id
    session.commit()
    return folder


def delete_folder(session: Session, folder: Folder) -> None:
    has_folders = session.scalar(select(Folder.id).where(Folder.parent_id == folder.id).limit(1))
    has_notes = session.scalar(
        select(Note.id).where(Note.folder_id == folder.id, Note.deleted_at.is_(None)).limit(1)
    )
    if has_folders or has_notes:
        raise NotesError("Only empty folders can be deleted")
    # Notes already in Trash keep living there, just without the folder.
    session.execute(update(Note).where(Note.folder_id == folder.id).values(folder_id=None))
    session.delete(folder)
    session.commit()


# Reading


def summarize(note: Note) -> NoteSummary:
    return NoteSummary(
        id=note.id,
        title=note.title,
        folder_id=note.folder_id,
        tags=[tag.name for tag in note.tags],
        updated_at=note.updated_at,
        deleted_at=note.deleted_at,
    )


def tree(session: Session) -> NoteTree:
    folders = session.scalars(select(Folder).order_by(func.lower(Folder.name))).all()
    notes = session.scalars(
        select(Note).where(Note.deleted_at.is_(None)).order_by(func.lower(Note.title))
    ).all()
    tag_names = session.scalars(
        select(Tag.name)
        .join(note_tags, note_tags.c.tag_id == Tag.id)
        .join(Note, Note.id == note_tags.c.note_id)
        .where(Note.deleted_at.is_(None))
        .distinct()
        .order_by(Tag.name)
    ).all()
    return NoteTree(
        folders=[FolderRead.model_validate(folder) for folder in folders],
        notes=[summarize(note) for note in notes],
        tags=list(tag_names),
    )


def trashed(session: Session) -> Sequence[Note]:
    return session.scalars(
        select(Note).where(Note.deleted_at.is_not(None)).order_by(Note.deleted_at.desc())
    ).all()


def get_note(session: Session, note_id: uuid.UUID, *, trashed: bool = False) -> Note:
    note = session.get(Note, note_id)
    if note is None or (note.deleted_at is not None) != trashed:
        raise NotFoundError
    return note


def _model(kind: LinkKind) -> type[Linkable]:
    return Note if kind is LinkKind.NOTE else RECORD_MODELS[kind]


def _target_title(session: Session, kind: LinkKind, target_id: uuid.UUID) -> str | None:
    record = cast(Linkable | None, session.get(_model(kind), target_id))
    if record is None or record.deleted_at is not None:
        return None
    return record.title


def read(session: Session, note: Note) -> NoteRead:
    links = []
    for link in session.scalars(
        select(NoteLink).where(NoteLink.source_id == note.id).order_by(NoteLink.label)
    ):
        title = _target_title(session, link.kind, link.target_id) if link.target_id else None
        links.append(
            LinkRead(
                label=link.label,
                kind=link.kind,
                target_id=link.target_id,
                target_title=title,
                resolved=title is not None,
            )
        )
    backlinks = session.execute(
        select(Note.id, Note.title)
        .join(NoteLink, NoteLink.source_id == Note.id)
        .where(
            NoteLink.kind == LinkKind.NOTE,
            NoteLink.target_id == note.id,
            Note.deleted_at.is_(None),
            Note.id != note.id,
        )
        .distinct()
        .order_by(Note.title)
    ).all()
    return NoteRead(
        **summarize(note).model_dump(),
        content=note.content,
        version=note.version,
        created_at=note.created_at,
        links=links,
        backlinks=[NoteRef(id=row.id, title=row.title) for row in backlinks],
    )


# Writing


def _ensure_title_free(session: Session, title: str, exclude: uuid.UUID | None) -> None:
    query = select(Note.id).where(
        func.lower(Note.title) == title.lower(), Note.deleted_at.is_(None)
    )
    if exclude is not None:
        query = query.where(Note.id != exclude)
    if session.scalar(query) is not None:
        raise NotesError("Another note already has this title")


def _tags(session: Session, raw: list[str]) -> list[Tag]:
    names = normalize_tags(raw)
    existing = {tag.name: tag for tag in session.scalars(select(Tag).where(Tag.name.in_(names)))}
    tags = []
    for name in names:
        tag = existing.get(name) or Tag(name=name)
        session.add(tag)
        tags.append(tag)
    return tags


def _resolve(session: Session, kind: LinkKind, name: str) -> uuid.UUID | None:
    model = _model(kind)
    return session.scalar(
        select(model.id)
        .where(func.lower(model.title) == name.lower(), model.deleted_at.is_(None))
        .order_by(model.updated_at.desc())
        .limit(1)
    )


def _sync_links(session: Session, note: Note) -> None:
    """Keeps a resolved link's target even after the target is renamed; re-resolves the rest."""
    labels = parse_links(note.content)
    existing = {
        link.label: link
        for link in session.scalars(select(NoteLink).where(NoteLink.source_id == note.id))
    }
    for label, link in existing.items():
        if label not in labels:
            session.delete(link)
    for label in labels:
        kind, name = split_label(label)
        current = existing.get(label)
        if current is None:
            session.add(
                NoteLink(
                    source_id=note.id,
                    label=label,
                    kind=kind,
                    target_id=_resolve(session, kind, name),
                )
            )
        elif current.target_id is None:
            current.target_id = _resolve(session, kind, name)


def _claim_dangling_links(session: Session, note: Note) -> None:
    """Links written before this note existed (or under its new title) now point at it."""
    session.execute(
        update(NoteLink)
        .where(
            NoteLink.kind == LinkKind.NOTE,
            NoteLink.target_id.is_(None),
            func.lower(NoteLink.label) == note.title.lower(),
        )
        .values(target_id=note.id)
    )


def _snapshot(session: Session, note: Note, now: datetime, *, separate: bool = False) -> None:
    latest = session.scalars(
        select(NoteVersion)
        .where(NoteVersion.note_id == note.id)
        .order_by(NoteVersion.saved_at.desc())
        .limit(1)
    ).first()
    if not separate and latest is not None and now - latest.saved_at < SNAPSHOT_WINDOW:
        latest.title, latest.content, latest.saved_at = note.title, note.content, now
    else:
        session.add(
            NoteVersion(note_id=note.id, title=note.title, content=note.content, saved_at=now)
        )
    session.flush()
    stale = (
        select(NoteVersion.id)
        .where(NoteVersion.note_id == note.id)
        .order_by(NoteVersion.saved_at.desc())
        .offset(MAX_VERSIONS)
    )
    session.execute(delete(NoteVersion).where(NoteVersion.id.in_(stale)))


def create_note(session: Session, data: NoteCreate, now: datetime) -> Note:
    _ensure_title_free(session, data.title, None)
    _folder(session, data.folder_id)
    note = Note(
        title=data.title,
        content=data.content,
        folder_id=data.folder_id,
        tags=_tags(session, data.tags),
        created_at=now,
        updated_at=now,
    )
    session.add(note)
    session.flush()
    _sync_links(session, note)
    _claim_dangling_links(session, note)
    _snapshot(session, note, now)
    session.commit()
    return note


def save_note(session: Session, note: Note, data: NoteSave, now: datetime) -> Note:
    if data.base_version != note.version:
        raise StaleSaveError(note)
    _ensure_title_free(session, data.title, note.id)
    _folder(session, data.folder_id)
    renamed = data.title != note.title
    if data.preserve_current:
        replaced_at = now - timedelta(microseconds=1)
        session.add(
            NoteVersion(
                note_id=note.id, title=note.title, content=note.content, saved_at=replaced_at
            )
        )
    note.title, note.content, note.folder_id = data.title, data.content, data.folder_id
    note.tags = _tags(session, data.tags)
    note.version += 1
    note.updated_at = now
    session.flush()
    _sync_links(session, note)
    if renamed:
        _claim_dangling_links(session, note)
    _snapshot(session, note, now, separate=data.preserve_current)
    session.commit()
    session.refresh(note)
    return note


def trash_note(session: Session, note: Note, now: datetime) -> None:
    note.deleted_at = now
    session.commit()


def restore_note(session: Session, note: Note) -> Note:
    _ensure_title_free(session, note.title, note.id)
    note.deleted_at = None
    session.commit()
    return note


# Versions and link targets


def versions(session: Session, note: Note) -> list[VersionSummary]:
    rows = session.execute(
        select(
            NoteVersion.id,
            NoteVersion.title,
            NoteVersion.saved_at,
            func.length(NoteVersion.content),
        )
        .where(NoteVersion.note_id == note.id)
        .order_by(NoteVersion.saved_at.desc())
    ).all()
    return [VersionSummary(id=row[0], title=row[1], saved_at=row[2], length=row[3]) for row in rows]


def get_version(session: Session, note: Note, version_id: uuid.UUID) -> NoteVersion:
    version = session.get(NoteVersion, version_id)
    if version is None or version.note_id != note.id:
        raise NotFoundError
    return version


def link_targets(session: Session, query: str) -> list[LinkTarget]:
    """Autocomplete for `[[`: notes by default, records when the query has a kind prefix."""
    kind, name = split_label(query) if ":" in query else (LinkKind.NOTE, query)
    model = _model(kind)
    pattern = "%" + name.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    rows = session.execute(
        select(model.id, model.title)
        .where(model.deleted_at.is_(None), model.title.ilike(pattern, escape="\\"))
        .order_by(func.length(model.title), model.title)
        .limit(TARGET_SUGGESTIONS)
    ).all()
    return [LinkTarget(kind=kind, id=row[0], title=row[1]) for row in rows]
