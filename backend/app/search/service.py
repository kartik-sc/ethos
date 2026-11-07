"""One search across record types. Plain case-insensitive substring matching is enough at a
single owner's scale. Notes match on title, folder name and tags only: bodies are never searched."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import ColumnElement, or_, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.core.life_areas import LifeArea
from app.goals.models import Goal
from app.habits.models import Habit
from app.inbox.models import InboxItem
from app.notes.models import Folder, Note, Tag, note_tags
from app.projects.models import Project
from app.search.schemas import SearchHit, SearchKind, SearchResults, StatusFilter
from app.tasks.models import Task, TaskStatus

PER_KIND_LIMIT = 20
SNIPPET_RADIUS = 60


@dataclass(frozen=True)
class SearchFilters:
    kinds: frozenset[SearchKind]
    area: LifeArea | None = None
    status: StatusFilter | None = None


def _pattern(query: str) -> str:
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _matches(
    pattern: str, *columns: InstrumentedAttribute[str] | InstrumentedAttribute[str | None]
) -> ColumnElement[bool]:
    return or_(*(column.ilike(pattern, escape="\\") for column in columns))


def snippet(text: str | None, query: str) -> str | None:
    """A window of text around the first match, or None when the text does not contain it."""
    if not text:
        return None
    index = text.lower().find(query.lower())
    if index < 0:
        return None
    start = max(0, index - SNIPPET_RADIUS)
    end = min(len(text), index + len(query) + SNIPPET_RADIUS)
    excerpt = " ".join(text[start:end].split())
    return f"{'…' if start else ''}{excerpt}{'…' if end < len(text) else ''}"


def _task_status(task: Task, archive_before: datetime) -> str:
    closed_at = task.completed_at or task.cancelled_at
    if task.status is not TaskStatus.OPEN and closed_at and closed_at < archive_before:
        return "archived"
    return task.status.value


def _tasks(
    session: Session, query: str, filters: SearchFilters, archive_before: datetime
) -> list[SearchHit]:
    statement = select(Task).where(
        Task.deleted_at.is_(None), _matches(_pattern(query), Task.title, Task.description)
    )
    if filters.area:
        statement = statement.where(Task.area == filters.area)
    if filters.status == "open":
        statement = statement.where(Task.status == TaskStatus.OPEN)
    elif filters.status == "closed":
        statement = statement.where(Task.status != TaskStatus.OPEN)
    statement = statement.order_by(Task.status != TaskStatus.OPEN, Task.updated_at.desc())
    return [
        SearchHit(
            kind="task",
            id=task.id,
            title=task.title,
            snippet=snippet(task.description, query),
            area=task.area,
            status=_task_status(task, archive_before),
            date=task.due_date,
            context=task.project.title if task.project else None,
        )
        for task in session.scalars(statement.limit(PER_KIND_LIMIT + 1))
    ]


def _projects(session: Session, query: str, filters: SearchFilters) -> list[SearchHit]:
    if filters.status == "closed":
        return []
    statement = select(Project).where(
        Project.deleted_at.is_(None), _matches(_pattern(query), Project.title, Project.description)
    )
    if filters.area:
        statement = statement.where(Project.area == filters.area)
    return [
        SearchHit(
            kind="project",
            id=project.id,
            title=project.title,
            snippet=snippet(project.description, query),
            area=project.area,
            status="active",
            date=project.due_date,
        )
        for project in session.scalars(
            statement.order_by(Project.updated_at.desc()).limit(PER_KIND_LIMIT + 1)
        )
    ]


def _goals(session: Session, query: str, filters: SearchFilters) -> list[SearchHit]:
    if filters.status == "closed":
        return []
    statement = select(Goal).where(
        Goal.deleted_at.is_(None), _matches(_pattern(query), Goal.title, Goal.description)
    )
    if filters.area:
        statement = statement.where(Goal.area == filters.area)
    return [
        SearchHit(
            kind="goal",
            id=goal.id,
            title=goal.title,
            snippet=snippet(goal.description, query),
            area=goal.area,
            status="active",
            date=goal.target_date,
        )
        for goal in session.scalars(
            statement.order_by(Goal.updated_at.desc()).limit(PER_KIND_LIMIT + 1)
        )
    ]


def _habits(session: Session, query: str, filters: SearchFilters) -> list[SearchHit]:
    if filters.status == "closed":
        return []
    statement = select(Habit).where(
        Habit.deleted_at.is_(None), _matches(_pattern(query), Habit.title, Habit.description)
    )
    if filters.area:
        statement = statement.where(Habit.area == filters.area)
    return [
        SearchHit(
            kind="habit",
            id=habit.id,
            title=habit.title,
            snippet=snippet(habit.description, query),
            area=habit.area,
            status="active",
            date=None,
        )
        for habit in session.scalars(statement.order_by(Habit.created_at).limit(PER_KIND_LIMIT + 1))
    ]


def _notes(session: Session, query: str, filters: SearchFilters) -> list[SearchHit]:
    if filters.area or filters.status == "closed":
        return []  # notes have no area or status
    pattern = _pattern(query)
    tagged = (
        select(note_tags.c.note_id)
        .join(Tag, Tag.id == note_tags.c.tag_id)
        .where(Tag.name.ilike(pattern, escape="\\"))
    )
    statement = (
        select(Note)
        .outerjoin(Folder, Folder.id == Note.folder_id)
        .where(
            Note.deleted_at.is_(None),
            or_(_matches(pattern, Note.title, Folder.name), Note.id.in_(tagged)),
        )
        .order_by(Note.updated_at.desc())
        .limit(PER_KIND_LIMIT + 1)
    )
    return [
        SearchHit(
            kind="note",
            id=note.id,
            title=note.title,
            snippet=None,  # never surface body text
            area=None,
            status="note",
            date=None,
            context=" · ".join(
                part
                for part in (
                    note.folder.name if note.folder else None,
                    *(f"#{t.name}" for t in note.tags),
                )
                if part
            )
            or None,
        )
        for note in session.scalars(statement)
    ]


def _inbox(session: Session, query: str, filters: SearchFilters) -> list[SearchHit]:
    if filters.area:
        return []  # captures have no area yet
    statement = select(InboxItem).where(_matches(_pattern(query), InboxItem.content))
    if filters.status == "open":
        statement = statement.where(InboxItem.processed_at.is_(None))
    elif filters.status == "closed":
        statement = statement.where(InboxItem.processed_at.is_not(None))
    hits = []
    for item in session.scalars(
        statement.order_by(InboxItem.created_at.desc()).limit(PER_KIND_LIMIT + 1)
    ):
        first_line = item.content.strip().splitlines()[0][:200]
        hits.append(
            SearchHit(
                kind="inbox",
                id=item.id,
                title=first_line,
                snippet=snippet(item.content, query)
                if item.content.strip() != first_line
                else None,
                area=None,
                status="processed" if item.processed_at else "open",
                date=None,
            )
        )
    return hits


def search(
    session: Session, query: str, filters: SearchFilters, archive_before: datetime
) -> SearchResults:
    query = query.strip()
    groups: dict[SearchKind, Iterable[SearchHit]] = {}
    if "task" in filters.kinds:
        groups["task"] = _tasks(session, query, filters, archive_before)
    if "project" in filters.kinds:
        groups["project"] = _projects(session, query, filters)
    if "goal" in filters.kinds:
        groups["goal"] = _goals(session, query, filters)
    if "habit" in filters.kinds:
        groups["habit"] = _habits(session, query, filters)
    if "note" in filters.kinds:
        groups["note"] = _notes(session, query, filters)
    if "inbox" in filters.kinds:
        groups["inbox"] = _inbox(session, query, filters)

    hits: list[SearchHit] = []
    truncated = False
    for group in groups.values():
        found = list(group)
        truncated = truncated or len(found) > PER_KIND_LIMIT
        hits.extend(found[:PER_KIND_LIMIT])
    return SearchResults(query=query, hits=hits, truncated=truncated)
