from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.preferences.service import get_preferences


def owner_timezone(session: Annotated[Session, Depends(get_session)]) -> str:
    """The owner's configured IANA timezone; every "today" and local time derives from it."""
    return get_preferences(session).timezone


TimezoneDep = Annotated[str, Depends(owner_timezone)]
