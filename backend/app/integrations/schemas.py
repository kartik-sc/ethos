import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, StringConstraints

from app.commands.schemas import CommandText, RecordKind
from app.core.fields import Title

TokenName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class TokenCreate(BaseModel):
    name: TokenName


class TokenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None


class TokenCreated(TokenRead):
    # Shown once. Ethos keeps only a hash.
    token: str


class CaptureRequest(BaseModel):
    text: CommandText


class CaptureResult(BaseModel):
    # "executed": a clear command ran. "inbox": stored as a capture to process later.
    status: Literal["executed", "inbox"]
    message: str
    record_kind: RecordKind | None
    record_id: uuid.UUID | None


ClipText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]


class ClipRequest(BaseModel):
    title: Title
    url: AnyHttpUrl
    # Converted by the extension; the server stores it as-is, so no HTML is ever rendered.
    markdown: Annotated[str, StringConstraints(max_length=450_000)]
    selection: bool = False
    note: Annotated[str, StringConstraints(max_length=2000)] | None = None
    folder_id: uuid.UUID | None = None
    site_name: ClipText | None = None
    author: ClipText | None = None
    published: ClipText | None = None
    description: Annotated[str, StringConstraints(max_length=1000)] | None = None


class ClipResult(BaseModel):
    note_id: uuid.UUID
    title: str
    folder: str


class ClipFolder(BaseModel):
    id: uuid.UUID
    path: str


class ClipFolders(BaseModel):
    # The Clippings folder, once it exists; clips go there unless another is chosen.
    suggested_id: uuid.UUID | None
    suggested_name: str
    folders: list[ClipFolder]
