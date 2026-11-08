from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.files.models import FileAsset
from app.goals.models import Goal
from app.habits.models import Habit
from app.notes.models import Note
from app.projects.models import Project
from app.tasks.models import Task

RETENTION = timedelta(days=30)


@dataclass(frozen=True)
class Purged:
    tasks: int
    projects: int
    goals: int
    habits: int
    notes: int
    files: int


def purge_expired(session: Session, now: datetime) -> Purged:
    """Permanently deletes records that have been in Trash longer than the retention period.

    Projects cascade to their tasks and habits to their logs in the database. Goals only
    unlink: their projects, tasks and habits are independent records. Notes take their
    versions and outgoing links; links pointing at a purged note simply stop resolving.
    File rows go here; their blobs are removed by the worker's orphan sweep.
    """
    cutoff = now - RETENTION
    counts = {}
    models = (
        ("tasks", Task),
        ("files", FileAsset),
        ("projects", Project),
        ("goals", Goal),
        ("habits", Habit),
        ("notes", Note),
    )
    for name, model in models:
        deleted = session.scalars(
            delete(model).where(model.deleted_at < cutoff).returning(model.id)
        ).all()
        counts[name] = len(deleted)
    session.commit()
    return Purged(**counts)
