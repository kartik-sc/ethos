from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.calendar import sync
from app.calendar.models import BlockKind, BlockStatus, CalendarBlock, SyncOp
from app.calendar.service import MAX_SYNC_ATTEMPTS, read, release

NOW = datetime(2030, 1, 7, 3, 30, tzinfo=UTC)


class FakeCalendar:
    """Behaves like Google Calendar where it matters: client-chosen ids are unique."""

    def __init__(self) -> None:
        self.events: dict[str, str] = {}
        self.down = False
        self.reject: set[str] = set()
        self.calls = 0

    def _guard(self, title: str) -> None:
        self.calls += 1
        if self.down:
            raise sync.ProviderUnavailableError("network unreachable")
        if title in self.reject:
            raise sync.ProviderRejectedError("event rejected")

    def create(self, block: CalendarBlock, event_id: str) -> str:
        self._guard(block.title)
        self.events.setdefault(event_id, block.title)  # an existing id is not created twice
        return event_id

    def delete(self, external_id: str) -> None:
        self._guard("")
        self.events.pop(external_id, None)


def block(session: Session, title: str, hour: int = 9) -> CalendarBlock:
    created = CalendarBlock(
        kind=BlockKind.TASK,
        title=title,
        starts_at=NOW.replace(hour=hour),
        ends_at=NOW.replace(hour=hour) + timedelta(hours=1),
        sync_op=SyncOp.CREATE,
    )
    session.add(created)
    session.commit()
    return created


def test_pending_creates_are_pushed_once_and_marked_synced(session: Session) -> None:
    calendar = FakeCalendar()
    first, second = block(session, "Essay"), block(session, "Lab", 11)

    report = sync.push_pending(session, calendar, NOW)

    assert report.pushed == 2
    assert sorted(calendar.events.values()) == ["Essay", "Lab"]
    for item in (first, second):
        session.refresh(item)
        assert item.sync_op is None and item.external_id == sync.event_id(item)
        assert read(item).sync == "synced"
    assert sync.push_pending(session, calendar, NOW).pushed == 0, "nothing left to push"


def test_a_crash_after_create_does_not_create_a_second_event(session: Session) -> None:
    calendar = FakeCalendar()
    pending = block(session, "Essay")
    calendar.create(pending, sync.event_id(pending))  # pushed, but the commit never happened

    sync.push_pending(session, calendar, NOW)

    assert list(calendar.events.values()) == ["Essay"]


def test_outage_keeps_changes_pending_without_counting_attempts(session: Session) -> None:
    calendar = FakeCalendar()
    calendar.down = True
    pending = block(session, "Essay")

    report = sync.push_pending(session, calendar, NOW)

    session.refresh(pending)
    assert report.deferred and report.pushed == 0
    assert (pending.sync_op, pending.sync_attempts) == (SyncOp.CREATE, 0)
    assert read(pending).sync == "pending"
    calendar.down = False
    assert sync.push_pending(session, calendar, NOW).pushed == 1


def test_rejections_are_retried_then_surface_as_failed(session: Session) -> None:
    calendar = FakeCalendar()
    calendar.reject.add("Bad")
    bad, good = block(session, "Bad"), block(session, "Good", 11)

    for _ in range(MAX_SYNC_ATTEMPTS + 2):
        sync.push_pending(session, calendar, NOW)

    session.refresh(bad)
    session.refresh(good)
    assert read(good).sync == "synced", "one rejected block never blocks the others"
    assert bad.sync_attempts == MAX_SYNC_ATTEMPTS
    assert bad.sync_error == "event rejected"
    assert read(bad).sync == "failed"
    assert calendar.calls == MAX_SYNC_ATTEMPTS + 1, "no retries past the limit"


def test_deletions_reach_the_calendar_before_the_row_goes(session: Session) -> None:
    calendar = FakeCalendar()
    pending = block(session, "Essay")
    sync.push_pending(session, calendar, NOW)
    session.refresh(pending)

    release(session, pending)
    session.commit()
    assert pending.status is BlockStatus.CANCELLED and pending.sync_op is SyncOp.DELETE

    sync.push_pending(session, calendar, NOW)

    assert calendar.events == {}
    assert session.scalars(select(CalendarBlock)).all() == []


def test_the_outbox_cannot_hold_an_update_that_would_be_marked_synced(session: Session) -> None:
    """Blocks are never edited in place, so an update entry could only ever be a false success."""
    created = block(session, "Essay")
    with pytest.raises(IntegrityError):
        session.execute(
            text("UPDATE calendar_blocks SET sync_op = 'update' WHERE id = :id"), {"id": created.id}
        )
    session.rollback()
    assert session.get(CalendarBlock, created.id).sync_op is SyncOp.CREATE


def test_without_a_connection_nothing_is_pushed() -> None:
    assert sync.get_provider() is None
