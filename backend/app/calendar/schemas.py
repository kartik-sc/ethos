import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.calendar.models import BlockKind, BlockStatus

HorizonDays = Annotated[int, Field(ge=1, le=28)]
SyncState = Literal["synced", "pending", "failed"]


class BlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: BlockKind
    title: str
    starts_at: datetime
    ends_at: datetime
    task_id: uuid.UUID | None
    habit_id: uuid.UUID | None
    status: BlockStatus
    fixed: bool
    recovers_id: uuid.UUID | None
    sync: SyncState


class CalendarStatus(BaseModel):
    # Google Calendar is not connected until the owner's OAuth client exists.
    connected: bool
    # Ethos changes waiting to be written to Google Calendar.
    pending: int


class PlanRequest(BaseModel):
    horizon_days: HorizonDays = 7
    # False previews the plan; true creates the blocks.
    apply: bool = False


class PlannedBlock(BaseModel):
    task_id: uuid.UUID
    title: str
    starts_at: datetime
    ends_at: datetime


class UnplacedTask(BaseModel):
    task_id: uuid.UUID
    title: str
    minutes: int
    due_date: date | None
    reason: str


class PlanResult(BaseModel):
    applied: bool
    placed: list[PlannedBlock]
    # What does not fit. Nothing is overbooked or moved to make room.
    unplaced: list[UnplacedTask]
