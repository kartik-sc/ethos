import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.core.life_areas import LifeArea

SearchKind = Literal["task", "project", "goal", "habit", "inbox"]
StatusFilter = Literal["open", "closed"]


class SearchHit(BaseModel):
    kind: SearchKind
    id: uuid.UUID
    title: str
    # A short excerpt around the match when it was found in the body text.
    snippet: str | None
    area: LifeArea | None
    # open, done, cancelled, archived, active, processed
    status: str
    # Due date, deadline or target date when the record has one.
    date: date | None
    # A task's project, when it has one.
    context: str | None = None


class SearchResults(BaseModel):
    query: str
    hits: list[SearchHit]
    # True when a kind hit the per-kind cap and more matches exist.
    truncated: bool
