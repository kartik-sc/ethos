import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel


class Deadline(BaseModel):
    kind: Literal["task", "project", "goal"]
    id: uuid.UUID
    title: str
    date: date
    # Negative when overdue.
    days: int
    # A task's project, when it has one.
    context: str | None = None


class TaskCounts(BaseModel):
    open: int
    overdue: int
    done_today: int
    done_this_week: int


class Dashboard(BaseModel):
    deadlines: list[Deadline]
    tasks: TaskCounts
