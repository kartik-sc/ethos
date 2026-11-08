from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.preferences.models import Preferences
from app.preferences.schemas import PreferencesUpdate


def get_preferences(session: Session) -> Preferences:
    """Creates the single row with defaults on first use."""
    preferences = session.get(Preferences, 1)
    if preferences is None:
        session.execute(
            insert(Preferences)
            .values(id=1, timezone=get_settings().default_timezone)
            .on_conflict_do_nothing()
        )
        session.commit()
        preferences = session.get(Preferences, 1)
    assert preferences is not None
    return preferences


class InvalidPreferencesError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message


def update_preferences(session: Session, changes: PreferencesUpdate) -> Preferences:
    preferences = get_preferences(session)
    fields = changes.model_dump(exclude_unset=True, exclude_none=True)
    starts = fields.get("day_starts_at", preferences.day_starts_at)
    ends = fields.get("day_ends_at", preferences.day_ends_at)
    if starts >= ends:
        session.rollback()
        raise InvalidPreferencesError("The working day must start before it ends")
    for name, value in fields.items():
        setattr(preferences, name, value)
    session.commit()
    return preferences
