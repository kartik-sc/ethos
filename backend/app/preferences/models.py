from datetime import time

from sqlalchemy import CheckConstraint, SmallInteger, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

DEFAULT_ARCHIVE_AFTER_DAYS = 30
DEFAULT_TASK_MINUTES = 60
DEFAULT_DAY_STARTS_AT = time(8, 0)
DEFAULT_DAY_ENDS_AT = time(22, 0)


class Preferences(Base):
    """The owner's app-wide settings: exactly one row."""

    __tablename__ = "preferences"
    __table_args__ = (
        CheckConstraint("id = 1", name="single_row"),
        CheckConstraint("day_starts_at < day_ends_at", name="day_window"),
    )

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    # Done and cancelled tasks leave the Done list this many days after closing.
    archive_after_days: Mapped[int] = mapped_column(
        SmallInteger, default=DEFAULT_ARCHIVE_AFTER_DAYS, server_default="30"
    )
    # IANA name. The first row takes DEFAULT_TIMEZONE from the environment.
    timezone: Mapped[str] = mapped_column(String(64), server_default="Asia/Kolkata")
    # Used to schedule a task that has no planned duration of its own.
    default_task_minutes: Mapped[int] = mapped_column(
        SmallInteger, default=DEFAULT_TASK_MINUTES, server_default="60"
    )
    # Local clock times between which Ethos may place work blocks.
    day_starts_at: Mapped[time] = mapped_column(
        Time, default=DEFAULT_DAY_STARTS_AT, server_default="08:00"
    )
    day_ends_at: Mapped[time] = mapped_column(
        Time, default=DEFAULT_DAY_ENDS_AT, server_default="22:00"
    )
