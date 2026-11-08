import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.commands.schemas import CommandText, RecordKind

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
