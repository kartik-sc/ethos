from sqlalchemy import CheckConstraint, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

DEFAULT_ARCHIVE_AFTER_DAYS = 30


class Preferences(Base):
    """The owner's app-wide settings: exactly one row."""

    __tablename__ = "preferences"
    __table_args__ = (CheckConstraint("id = 1", name="single_row"),)

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    # Done and cancelled tasks leave the Done list this many days after closing.
    archive_after_days: Mapped[int] = mapped_column(
        SmallInteger, default=DEFAULT_ARCHIVE_AFTER_DAYS, server_default="30"
    )
