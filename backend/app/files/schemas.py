import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.core.fields import Title

FileView = Literal["active", "trash"]


class FileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class FileConflict(BaseModel):
    detail: str
    existing: FileRead


class FileRename(BaseModel):
    filename: Title
