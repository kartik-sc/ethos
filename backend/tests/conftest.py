import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from pydantic_settings import BaseSettings, SettingsConfigDict


class _TestEnv(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")
    test_database_url: str


# Point the app at the test database before any app module reads settings.
TEST_DATABASE_URL = _TestEnv().test_database_url
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["ENVIRONMENT"] = "test"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, make_url, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.db import get_engine, get_sessionmaker  # noqa: E402

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def _ensure_database_exists(url: str) -> None:
    target = make_url(url)
    admin = create_engine(
        target.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
        connect_args={"connect_timeout": 5},
    )
    with admin.connect() as connection:
        exists = connection.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target.database}
        )
        if not exists:
            connection.execute(text(f'CREATE DATABASE "{target.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def migrated_database() -> Iterator[None]:
    _ensure_database_exists(TEST_DATABASE_URL)
    config = Config(str(ALEMBIC_INI))
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    yield
    get_engine().dispose()
    command.downgrade(config, "base")


def _truncate(db_session: Session) -> None:
    db_session.execute(
        text("TRUNCATE service_heartbeats, tasks, projects, goals, habits, inbox_items CASCADE")
    )
    db_session.commit()


@pytest.fixture
def session(migrated_database: None) -> Iterator[Session]:
    with get_sessionmaker()() as db_session:
        # Before as well as after: migrations seed data (the LeetCode habit).
        _truncate(db_session)
        yield db_session
        db_session.rollback()
        _truncate(db_session)


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
