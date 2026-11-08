import logging
import signal
import threading
from datetime import UTC, datetime, timedelta
from types import FrameType

from app.calendar import habit_sessions, sync
from app.calendar.service import Context
from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.logging import configure_logging
from app.files.service import sweep_orphans
from app.preferences.service import get_preferences
from app.system.service import WORKER_SERVICE, record_heartbeat
from app.trash.service import purge_expired

logger = logging.getLogger("ethos.worker")

# Every job catches everything it raises: one failing job is logged and retried on the next
# loop, and never stops the heartbeat or the other jobs. Jobs are idempotent, so a retry, a
# restart or a second worker cannot book or delete anything twice.

PURGE_EVERY = timedelta(hours=1)


def beat(started_at: datetime) -> None:
    try:
        with get_sessionmaker()() as session:
            record_heartbeat(session, WORKER_SERVICE, started_at, datetime.now(UTC))
    except Exception:
        logger.exception("heartbeat write failed")


def purge_trash() -> None:
    try:
        with get_sessionmaker()() as session:
            purged = purge_expired(session, datetime.now(UTC))
            swept = sweep_orphans(session, get_settings().file_storage_dir)
        if any(vars(purged).values()):
            logger.info("trash purged", extra=vars(purged))
        if swept:
            logger.info("orphaned file blobs removed", extra={"count": swept})
    except Exception:
        logger.exception("trash purge failed")


def refresh_habit_sessions() -> None:
    """Settles past habit sessions (recovering a missed protected one the same day) and books
    today's and tomorrow's."""
    try:
        with get_sessionmaker()() as session:
            context = Context.of(get_preferences(session), datetime.now(UTC))
            report = habit_sessions.refresh(session, context, context.today + timedelta(days=1))
        changes = {
            name: value for name, value in vars(report).items() if name != "unbooked" and value
        }
        if changes:
            logger.info("habit sessions refreshed", extra=changes)
    except Exception:
        logger.exception("habit session refresh failed")


def sync_calendar() -> None:
    """Pushes pending block changes once a calendar provider is connected; until then they wait."""
    provider = sync.get_provider()
    if provider is None:
        return
    try:
        with get_sessionmaker()() as session:
            report = sync.push_pending(session, provider, datetime.now(UTC))
        if report.pushed or report.rejected or report.deferred:
            logger.info("calendar sync", extra=vars(report))
    except Exception:
        logger.exception("calendar sync failed")


def run(stop: threading.Event) -> None:
    interval = get_settings().worker_heartbeat_seconds
    started_at = datetime.now(UTC)
    last_purge: datetime | None = None
    logger.info("worker started", extra={"heartbeat_seconds": interval})
    while not stop.is_set():
        beat(started_at)
        refresh_habit_sessions()
        sync_calendar()
        if last_purge is None or datetime.now(UTC) - last_purge >= PURGE_EVERY:
            purge_trash()
            last_purge = datetime.now(UTC)
        stop.wait(interval)
    logger.info("worker stopped")


def main() -> None:
    settings = get_settings()
    configure_logging("worker", settings.log_level)
    stop = threading.Event()

    def request_stop(signum: int, _frame: FrameType | None) -> None:
        logger.info("shutdown requested", extra={"signal": signal.Signals(signum).name})
        stop.set()

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    run(stop)


if __name__ == "__main__":
    main()
