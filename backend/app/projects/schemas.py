import uuid
from datetime import date, datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, model_validator

from app.core.fields import Description, Title
from app.core.life_areas import LifeArea
from app.goals.schemas import GoalRef

ProjectView = Literal["active", "trash"]


class ProjectCreate(BaseModel):
    title: Title
    description: Description | None = None
    area: LifeArea | None = None
    due_date: date | None = None
    goal_id: uuid.UUID | None = None


class ProjectUpdate(BaseModel):
    """Partial update: only fields present in the request body are changed."""

    title: Title | None = None
    description: Description | None = None
    area: LifeArea | None = None
    due_date: date | None = None
    goal_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def title_not_null(self) -> Self:
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("title cannot be null")
        return self


class ProjectRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str


class TaskCounts(BaseModel):
    open: int = 0
    done: int = 0
    next_due: date | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    area: LifeArea | None
    due_date: date | None
    goal_id: uuid.UUID | None
    goal: GoalRef | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    tasks: TaskCounts


class ProjectTrashed(BaseModel):
    tasks_moved: int
