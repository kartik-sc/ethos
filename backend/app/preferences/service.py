from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.preferences.models import Preferences
from app.preferences.schemas import PreferencesUpdate


def get_preferences(session: Session) -> Preferences:
    """Creates the single row with defaults on first use."""
    preferences = session.get(Preferences, 1)
    if preferences is None:
        session.execute(insert(Preferences).values(id=1).on_conflict_do_nothing())
        session.commit()
        preferences = session.get(Preferences, 1)
    assert preferences is not None
    return preferences


def update_preferences(session: Session, changes: PreferencesUpdate) -> Preferences:
    preferences = get_preferences(session)
    for name, value in changes.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(preferences, name, value)
    session.commit()
    return preferences
