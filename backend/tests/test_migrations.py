from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy.orm import Session

import app.system.models  # noqa: F401
from app.core.db import Base


def test_models_match_migrations(session: Session) -> None:
    context = MigrationContext.configure(session.connection())
    assert compare_metadata(context, Base.metadata) == []
