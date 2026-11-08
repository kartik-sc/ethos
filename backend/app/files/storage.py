"""Blob storage on the persistent volume. Keys are random hex; user filenames never touch paths."""

import hashlib
import os
import secrets
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

MAX_BYTES = 25 * 1024 * 1024


class FileTooLargeError(Exception):
    pass


@dataclass(frozen=True)
class StoredBlob:
    key: str
    size: int
    sha256: str


def _path(root: Path, key: str) -> Path:
    if len(key) != 32 or not all(char in "0123456789abcdef" for char in key):
        raise ValueError("invalid storage key")
    return root / key[:2] / key


async def write_blob(root: Path, chunks: AsyncIterator[bytes]) -> StoredBlob:
    """Streams to a temporary file and renames it into place, so a failed upload leaves no blob."""
    key = secrets.token_hex(16)
    target = _path(root, key)
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part")
    digest = hashlib.sha256()
    size = 0
    try:
        with partial.open("wb") as handle:
            async for chunk in chunks:
                size += len(chunk)
                if size > MAX_BYTES:
                    raise FileTooLargeError
                digest.update(chunk)
                handle.write(chunk)
            handle.flush()
            os.fsync(handle.fileno())
        partial.replace(target)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    return StoredBlob(key=key, size=size, sha256=digest.hexdigest())


def blob_path(root: Path, key: str) -> Path:
    return _path(root, key)


def delete_blob(root: Path, key: str) -> None:
    _path(root, key).unlink(missing_ok=True)


def stored_keys(root: Path) -> dict[str, float]:
    """Every finished blob on disk with its modification time."""
    if not root.exists():
        return {}
    return {
        path.name: path.stat().st_mtime
        for path in root.glob("??/*")
        if path.is_file() and path.suffix == ""
    }
