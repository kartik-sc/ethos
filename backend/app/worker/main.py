import logging
import signal
import threading
from datetime import UTC, datetime
from types import FrameType

from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.logging import configure_logging
from app.system.service import WORKER_SERVICE, record_heartbeat

logger = logging.getLogger("ethos.worker")


def beat(started_at: datetime) -> None:
    try:
        with get_sessionmaker()() as session:
            record_heartbeat(session, WORKER_SERVICE, started_at, datetime.now(UTC))
    except SQLAlchemyError:
        logger.exception("heartbeat write failed")


def run(stop: threading.Event) -> None:
    interval = get_settings().worker_heartbeat_seconds
    started_at = datetime.now(UTC)
    logger.info("worker started", extra={"heartbeat_seconds": interval})
    while not stop.is_set():
        beat(started_at)
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
