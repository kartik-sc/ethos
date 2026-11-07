import uuid
from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.tasks.models import LifeArea, TaskPriority, TaskStatus

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Description = Annotated[str, StringConstraints(max_length=5000)]
PlannedMinutes = Annotated[int, Field(ge=5, le=720)]

TaskView = Literal["open", "done", "trash"]


class TaskCreate(BaseModel):
    title: Title
    description: Description | None = None
    area: LifeArea | None = None
    priority: TaskPriority = TaskPriority.NORMAL
    due_date: date | None = None
    planned_minutes: PlannedMinutes | None = None


class TaskUpdate(BaseModel):
    """Partial update: only fields present in the request body are changed."""

    title: Title | None = None
    description: Description | None = None
    area: LifeArea | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    planned_minutes: PlannedMinutes | None = None

    @model_validator(mode="after")
    def required_fields_not_null(self) -> Self:
        for name in ("title", "status", "priority"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    area: LifeArea | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    planned_minutes: int | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    cancelled_at: datetime | None
    deleted_at: datetime | None


class NextAction(BaseModel):
    task: TaskRead | None
    reason: str | None
    overridden: bool


class NextActionOverrideCreate(BaseModel):
    suggested_task_id: uuid.UUID | None
    chosen_task_id: uuid.UUID
