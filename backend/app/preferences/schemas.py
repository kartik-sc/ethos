from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

ArchiveDays = Annotated[int, Field(ge=1, le=365)]


class PreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    archive_after_days: int


class PreferencesUpdate(BaseModel):
    archive_after_days: ArchiveDays | None = None
