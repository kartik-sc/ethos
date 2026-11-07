import uuid
from datetime import date, datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, model_validator

from app.core.fields import Description, Title
from app.core.life_areas import LifeArea

GoalView = Literal["active", "trash"]


class GoalCreate(BaseModel):
    title: Title
    description: Description | None = None
    area: LifeArea | None = None
    target_date: date | None = None


class GoalUpdate(BaseModel):
    """Partial update: only fields present in the request body are changed."""

    title: Title | None = None
    description: Description | None = None
    area: LifeArea | None = None
    target_date: date | None = None

    @model_validator(mode="after")
    def title_not_null(self) -> Self:
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("title cannot be null")
        return self


class GoalRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str


class GoalProgress(BaseModel):
    """Tasks linked directly, or through a linked project. Cancelled tasks are left out."""

    done: int = 0
    total: int = 0
    projects: int = 0
    habits: int = 0


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    area: LifeArea | None
    target_date: date | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    progress: GoalProgress
