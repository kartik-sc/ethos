import uuid
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints

from app.commands.parser import CommandKind

CommandText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
]
RecordKind = Literal["task", "project", "goal", "habit", "note", "inbox"]


class CommandRequest(BaseModel):
    text: CommandText
    # Set after the owner has seen the possible duplicates and chosen to create anyway.
    confirm_duplicate: bool = False


class PreviewField(BaseModel):
    label: str
    value: str


class Duplicate(BaseModel):
    kind: RecordKind
    id: uuid.UUID
    title: str
    due: date | None


class CommandPreview(BaseModel):
    kind: CommandKind
    # What Enter will do, e.g. "Create task".
    action: str
    fields: list[PreviewField]
    question: str | None
    error: str | None
    notes: list[str]
    duplicates: list[Duplicate]
    # True when Enter can run it as it stands (duplicates still need a confirmation).
    ready: bool


class CommandResult(BaseModel):
    kind: CommandKind
    message: str
    record_kind: RecordKind | None
    record_id: uuid.UUID | None
    # For /search: the query to open.
    query: str | None = None
