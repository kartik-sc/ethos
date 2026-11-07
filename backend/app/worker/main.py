import logging
import signal
import threading
from datetime import UTC, datetime, timedelta
from types import FrameType

from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.logging import configure_logging
from app.system.service import WORKER_SERVICE, record_heartbeat
from app.trash.service import purge_expired

logger = logging.getLogger("ethos.worker")

PURGE_EVERY = timedelta(hours=1)


def beat(started_at: datetime) -> None:
    try:
        with get_sessionmaker()() as session:
            record_heartbeat(session, WORKER_SERVICE, started_at, datetime.now(UTC))
    except SQLAlchemyError:
        logger.exception("heartbeat write failed")


def purge_trash() -> None:
    try:
        with get_sessionmaker()() as session:
            purged = purge_expired(session, datetime.now(UTC))
        if any(vars(purged).values()):
            logger.info("trash purged", extra=vars(purged))
    except SQLAlchemyError:
        logger.exception("trash purge failed")


def run(stop: threading.Event) -> None:
    interval = get_settings().worker_heartbeat_seconds
    started_at = datetime.now(UTC)
    last_purge: datetime | None = None
    logger.info("worker started", extra={"heartbeat_seconds": interval})
    while not stop.is_set():
        beat(started_at)
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
