from datetime import time
from typing import Annotated, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

ArchiveDays = Annotated[int, Field(ge=1, le=365)]
TaskMinutes = Annotated[int, Field(ge=5, le=480)]


def _known_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError(f"unknown IANA timezone: {value}") from None
    return value


Timezone = Annotated[str, Field(max_length=64), AfterValidator(_known_timezone)]


class PreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    archive_after_days: int
    timezone: str
    default_task_minutes: int
    day_starts_at: time
    day_ends_at: time


class PreferencesUpdate(BaseModel):
    archive_after_days: ArchiveDays | None = None
    timezone: Timezone | None = None
    default_task_minutes: TaskMinutes | None = None
    day_starts_at: time | None = None
    day_ends_at: time | None = None

    @model_validator(mode="after")
    def whole_minutes(self) -> Self:
        for moment in (self.day_starts_at, self.day_ends_at):
            if moment is not None and (moment.second or moment.microsecond or moment.tzinfo):
                raise ValueError("day window times are local hours and minutes")
        return self
