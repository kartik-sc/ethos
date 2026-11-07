from datetime import UTC, datetime, timedelta
from typing import Annotated, get_args

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.core.life_areas import LifeArea
from app.preferences.service import get_preferences
from app.search import service
from app.search.schemas import SearchKind, SearchResults, StatusFilter

router = APIRouter(prefix="/search", tags=["search"])

ALL_KINDS: frozenset[SearchKind] = frozenset(get_args(SearchKind))


@router.get("")
def search(
    session: Annotated[Session, Depends(get_session)],
    q: Annotated[str, Query(min_length=1, max_length=200)],
    kind: Annotated[list[SearchKind] | None, Query()] = None,
    area: Annotated[LifeArea | None, Query()] = None,
    status: Annotated[StatusFilter | None, Query()] = None,
) -> SearchResults:
    archive_days = get_preferences(session).archive_after_days
    filters = service.SearchFilters(
        kinds=frozenset(kind) if kind else ALL_KINDS, area=area, status=status
    )
    return service.search(session, q, filters, datetime.now(UTC) - timedelta(days=archive_days))
