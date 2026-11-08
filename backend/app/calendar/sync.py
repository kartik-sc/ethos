"""Pushes pending Ethos block changes to the calendar provider (Google Calendar once the owner's
OAuth client exists). Each block carries its own pending change, so nothing is lost while the
provider is down: changes simply wait.

Provider contract:
- `create` receives a stable event id derived from the block. If an event with that id already
  exists (a previous push succeeded but its commit did not), it returns that event's id instead
  of creating a second one. Google Calendar accepts client-chosen ids, so this maps directly.
- `ProviderUnavailableError` means "try later" (network, outage, revoked access): the batch
  stops and nothing counts as an attempt.
- `ProviderRejectedError` means this change was refused. It is retried on later runs up to
  MAX_SYNC_ATTEMPTS, then the block reads as *sync failed* in the UI until the owner acts.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.calendar.models import CalendarBlock, SyncOp
from app.calendar.service import MAX_SYNC_ATTEMPTS


class ProviderUnavailableError(Exception):
    pass


class ProviderRejectedError(Exception):
    pass


class CalendarProvider(Protocol):
    def create(self, block: CalendarBlock, event_id: str) -> str: ...

    def update(self, block: CalendarBlock, external_id: str) -> None: ...

    def delete(self, external_id: str) -> None: ...


def get_provider() -> CalendarProvider | None:
    """None until Google Calendar is connected; pending changes then simply wait."""
    return None


@dataclass
class SyncReport:
    pushed: int = 0
    rejected: int = 0
    deferred: bool = False


def event_id(block: CalendarBlock) -> str:
    """Google event ids use base32hex (0-9, a-v); a UUID's hex digits are a valid subset."""
    return f"ethos{block.id.hex}"


def _pending(session: Session, limit: int) -> Sequence[CalendarBlock]:
    return session.scalars(
        select(CalendarBlock)
        .where(
            CalendarBlock.sync_op.is_not(None),
            CalendarBlock.sync_attempts < MAX_SYNC_ATTEMPTS,
        )
        .order_by(CalendarBlock.updated_at)
        .limit(limit)
        .with_for_update(skip_locked=True)
    ).all()


def _apply(session: Session, block: CalendarBlock, provider: CalendarProvider) -> None:
    if block.sync_op is SyncOp.CREATE:
        block.external_id = provider.create(block, event_id(block))
    elif block.sync_op is SyncOp.UPDATE and block.external_id:
        provider.update(block, block.external_id)
    elif block.sync_op is SyncOp.DELETE:
        if block.external_id:
            provider.delete(block.external_id)
        session.delete(block)
        return
    block.sync_op = None
    block.sync_error = None
    block.sync_attempts = 0


def push_pending(
    session: Session, provider: CalendarProvider, now: datetime, limit: int = 50
) -> SyncReport:
    """Pushes up to `limit` pending changes, committing after each so a crash mid-batch keeps
    everything already confirmed by the provider."""
    report = SyncReport()
    for block in _pending(session, limit):
        try:
            _apply(session, block, provider)
        except ProviderUnavailableError:
            session.rollback()
            report.deferred = True
            break
        except ProviderRejectedError as rejected:
            block.sync_attempts += 1
            block.sync_error = str(rejected)[:500] or "rejected by the calendar"
            report.rejected += 1
        else:
            block.synced_at = now
            report.pushed += 1
        session.commit()
    return report
