import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.fields import Title
from app.notes.models import LinkKind

FolderName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120, pattern=r"^[^/]+$")
]
# Generous, but a ceiling keeps one runaway paste from bloating every version snapshot.
Content = Annotated[str, StringConstraints(max_length=500_000)]
RawTag = Annotated[str, StringConstraints(max_length=64)]

NoteView = Literal["active", "trash"]


class FolderCreate(BaseModel):
    name: FolderName
    parent_id: uuid.UUID | None = None


class FolderUpdate(BaseModel):
    """Rename and/or move. An explicit `parent_id: null` moves the folder to the top level."""

    name: FolderName | None = None
    parent_id: uuid.UUID | None = None


class FolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None


class NoteCreate(BaseModel):
    title: Title
    folder_id: uuid.UUID | None = None
    content: Content = ""
    tags: list[RawTag] = Field(default_factory=list, max_length=30)


class NoteBase(BaseModel):
    """The note as the editor loaded it: the common ancestor for a three-way merge."""

    title: str
    content: Content
    folder_id: uuid.UUID | None
    tags: list[RawTag] = Field(max_length=30)


class NoteSave(BaseModel):
    title: Title
    content: Content
    folder_id: uuid.UUID | None
    tags: list[RawTag] = Field(max_length=30)
    # The version the editor started from. A mismatch means someone else saved in between.
    base_version: int
    # Set when overwriting after a conflict: the version being replaced gets its own snapshot,
    # so resolving a conflict never loses either side.
    preserve_current: bool = False
    # When sent, a stale save is merged with the newer version instead of refused outright.
    base: NoteBase | None = None


class NoteRef(BaseModel):
    id: uuid.UUID
    title: str


class NoteSummary(BaseModel):
    id: uuid.UUID
    title: str
    folder_id: uuid.UUID | None
    tags: list[str]
    updated_at: datetime
    deleted_at: datetime | None


class LinkRead(BaseModel):
    label: str
    kind: LinkKind
    target_id: uuid.UUID | None
    # Current title of the target, which may differ from the label after a rename.
    target_title: str | None
    # False when nothing matches the label, or the target is in Trash or gone.
    resolved: bool


class NoteRead(NoteSummary):
    content: str
    version: int
    created_at: datetime
    links: list[LinkRead]
    backlinks: list[NoteRef]
    # True when this save was merged with a version saved elsewhere.
    merged: bool = False


class NoteTree(BaseModel):
    folders: list[FolderRead]
    notes: list[NoteSummary]
    tags: list[str]


class VersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    saved_at: datetime
    length: int


class VersionRead(VersionSummary):
    content: str


class LinkTarget(BaseModel):
    kind: LinkKind
    id: uuid.UUID
    title: str
