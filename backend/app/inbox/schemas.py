import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.core.fields import Title
from app.inbox.models import Outcome

InboxView = Literal["open", "processed"]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)]


class InboxCreate(BaseModel):
    content: Content


class InboxUpdate(BaseModel):
    content: Content


class ConvertRequest(BaseModel):
    kind: Literal["task", "project", "goal"]
    # Defaults to the first line of the capture.
    title: Title | None = None
    # Task or project deadline, or goal target date.
    due_date: date | None = None


class ResolveRequest(BaseModel):
    outcome: Literal["done", "dismissed"]


class InboxRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    source: str
    created_at: datetime
    updated_at: datetime
    processed_at: datetime | None
    outcome: Outcome | None
    result_id: uuid.UUID | None
