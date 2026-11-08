from alembic import context
from sqlalchemy import create_engine, pool

# Register every table on Base.metadata.
import app.files.models
import app.goals.models
import app.habits.models
import app.inbox.models
import app.integrations.models
import app.notes.models
import app.preferences.models
import app.projects.models
import app.quotes.models
import app.system.models
import app.tasks.models  # noqa: F401
from app.core.config import get_settings
from app.core.db import Base
from app.core.logging import configure_logging

settings = get_settings()
configure_logging("migrate", settings.log_level)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url.get_secret_value(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(settings.database_url.get_secret_value(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
