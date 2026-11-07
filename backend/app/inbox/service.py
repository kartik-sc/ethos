import uuid
from collections.abc import Sequence
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.goals.models import Goal
from app.inbox.models import InboxItem, Outcome
from app.inbox.schemas import ConvertRequest, InboxView
from app.projects.models import Project
from app.tasks.models import Task

PROCESSED_VIEW_LIMIT = 100
TITLE_LIMIT = 200


class InboxItemNotFoundError(Exception):
    pass


def split_capture(content: str) -> tuple[str, str | None]:
    """First line becomes the title; the full text is kept as the description when there is more."""
    first_line = next((line.strip() for line in content.splitlines() if line.strip()), content)
    title = first_line if len(first_line) <= TITLE_LIMIT else first_line[: TITLE_LIMIT - 1] + "…"
    return title, (content if content.strip() != title else None)


def list_items(session: Session, view: InboxView) -> Sequence[InboxItem]:
    if view == "open":
        query = (
            select(InboxItem)
            .where(InboxItem.processed_at.is_(None))
            .order_by(InboxItem.created_at)  # chronological: oldest first
        )
    else:
        query = (
            select(InboxItem)
            .where(InboxItem.processed_at.is_not(None))
            .order_by(InboxItem.processed_at.desc())
            .limit(PROCESSED_VIEW_LIMIT)
        )
    return session.scalars(query).all()


def get_item(session: Session, item_id: uuid.UUID, *, processed: bool = False) -> InboxItem:
    item = session.get(InboxItem, item_id)
    if item is None or (item.processed_at is not None) != processed:
        raise InboxItemNotFoundError
    return item


def capture(session: Session, content: str, source: str = "web") -> InboxItem:
    item = InboxItem(content=content, source=source)
    session.add(item)
    session.commit()
    return item


def edit(session: Session, item: InboxItem, content: str) -> InboxItem:
    item.content = content
    session.commit()
    return item


def _record(
    kind: str, title: str, description: str | None, due: date | None
) -> Task | Project | Goal:
    if kind == "task":
        return Task(title=title, description=description, due_date=due)
    if kind == "project":
        return Project(title=title, description=description, due_date=due)
    return Goal(title=title, description=description, target_date=due)


def convert(session: Session, item: InboxItem, request: ConvertRequest, now: datetime) -> InboxItem:
    """Creates the record and marks the item processed in one transaction."""
    derived_title, description = split_capture(item.content)
    title = request.title or derived_title
    if request.title and request.title != derived_title:
        description = item.content
    record = _record(request.kind, title, description, request.due_date)
    session.add(record)
    session.flush()
    item.processed_at, item.outcome, item.result_id = now, Outcome(request.kind), record.id
    session.commit()
    return item


def resolve(session: Session, item: InboxItem, outcome: Outcome, now: datetime) -> InboxItem:
    item.processed_at, item.outcome, item.result_id = now, outcome, None
    session.commit()
    return item


def reopen(session: Session, item: InboxItem) -> InboxItem:
    """Back to the open list. A record already created from it is left alone."""
    item.processed_at, item.outcome, item.result_id = None, None, None
    session.commit()
    return item
