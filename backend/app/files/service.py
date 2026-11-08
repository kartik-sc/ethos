import re
import time
import unicodedata
import uuid
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.files import storage
from app.files.models import FileAsset
from app.files.schemas import FileView
from app.projects.models import Project

ORPHAN_GRACE_SECONDS = 3600
_UNSAFE = re.compile(r"[\x00-\x1f\x7f<>:\"|?*]")


class FileAssetNotFoundError(Exception):
    pass


class InvalidFilenameError(Exception):
    pass


class FilenameTakenError(Exception):
    def __init__(self, existing: FileAsset) -> None:
        self.existing = existing


class ProjectTrashedError(Exception):
    pass


def clean_filename(raw: str) -> str:
    """A display name only: the last path segment, without control or reserved characters."""
    name = unicodedata.normalize("NFC", raw).replace("\\", "/").rsplit("/", 1)[-1]
    name = _UNSAFE.sub("", name).strip().strip(".")
    if not name:
        raise InvalidFilenameError
    if len(name) > 200:
        stem, dot, ext = name.rpartition(".")
        name = f"{stem[: 199 - len(ext)]}.{ext}" if dot and len(ext) <= 16 else name[:200]
    return name


def list_files(
    session: Session, project_id: uuid.UUID, view: FileView = "active"
) -> Sequence[FileAsset]:
    query = select(FileAsset).where(FileAsset.project_id == project_id)
    if view == "active":
        query = query.where(FileAsset.deleted_at.is_(None)).order_by(func.lower(FileAsset.filename))
    else:
        query = query.where(FileAsset.deleted_at.is_not(None)).order_by(FileAsset.deleted_at.desc())
    return session.scalars(query).all()


def get_file(session: Session, file_id: uuid.UUID, *, trashed: bool = False) -> FileAsset:
    asset = session.get(FileAsset, file_id)
    if asset is None or (asset.deleted_at is not None) != trashed:
        raise FileAssetNotFoundError
    return asset


def _live_named(
    session: Session, project_id: uuid.UUID, filename: str, *, excluding: uuid.UUID | None = None
) -> FileAsset | None:
    query = select(FileAsset).where(
        FileAsset.project_id == project_id,
        FileAsset.deleted_at.is_(None),
        func.lower(FileAsset.filename) == filename.lower(),
    )
    if excluding is not None:
        query = query.where(FileAsset.id != excluding)
    return session.scalars(query).first()


def ensure_name_free(session: Session, project_id: uuid.UUID, filename: str) -> None:
    existing = _live_named(session, project_id, filename)
    if existing is not None:
        raise FilenameTakenError(existing)


def store(
    session: Session,
    project_id: uuid.UUID,
    filename: str,
    content_type: str,
    blob: storage.StoredBlob,
    *,
    replace: bool,
) -> tuple[FileAsset, str | None]:
    """Records an uploaded blob. Returns the asset and the blob key it replaced, if any.

    A live file with the same name (ignoring case) is only replaced when `replace` is set;
    the application keeps the latest version only.
    """
    existing = _live_named(session, project_id, filename)
    if existing is not None and not replace:
        raise FilenameTakenError(existing)
    if existing is None:
        asset = FileAsset(project_id=project_id, filename=filename)
        session.add(asset)
        previous_key = None
    else:
        asset, previous_key = existing, existing.storage_key
        asset.filename = filename
    asset.content_type = content_type
    asset.size_bytes = blob.size
    asset.sha256 = blob.sha256
    asset.storage_key = blob.key
    session.commit()
    return asset, previous_key


def rename(session: Session, asset: FileAsset, filename: str) -> FileAsset:
    existing = _live_named(session, asset.project_id, filename, excluding=asset.id)
    if existing is not None:
        raise FilenameTakenError(existing)
    asset.filename = filename
    session.commit()
    return asset


def trash(session: Session, asset: FileAsset, now: datetime) -> None:
    asset.deleted_at = now
    session.commit()


def restore(session: Session, asset: FileAsset) -> FileAsset:
    project = session.get(Project, asset.project_id)
    if project is None or project.deleted_at is not None:
        raise ProjectTrashedError
    existing = _live_named(session, asset.project_id, asset.filename, excluding=asset.id)
    if existing is not None:
        raise FilenameTakenError(existing)
    asset.deleted_at = None
    session.commit()
    return asset


def sweep_orphans(session: Session, root: Path, now: float | None = None) -> int:
    """Deletes blobs no row points at: left by purges, replacements or interrupted requests.

    Recent blobs are skipped so an upload whose row is not committed yet is never touched.
    """
    on_disk = storage.stored_keys(root)
    if not on_disk:
        return 0
    known = set(session.scalars(select(FileAsset.storage_key)).all())
    cutoff = (time.time() if now is None else now) - ORPHAN_GRACE_SECONDS
    orphans = [key for key, mtime in on_disk.items() if key not in known and mtime < cutoff]
    for key in orphans:
        storage.delete_blob(root, key)
    return len(orphans)
