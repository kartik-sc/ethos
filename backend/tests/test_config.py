import pytest
from pydantic import ValidationError

from app.core.config import Settings

VALID_URL = "postgresql+psycopg://ethos:pw@localhost:5432/ethos"


def test_rejects_unknown_timezone() -> None:
    with pytest.raises(ValidationError, match="unknown IANA timezone"):
        Settings(database_url=VALID_URL, default_timezone="Mars/Olympus")


def test_rejects_non_psycopg_url_without_echoing_the_secret() -> None:
    with pytest.raises(ValidationError) as exc_info:
        Settings(database_url="postgres://ethos:hunter2@localhost/ethos")
    assert "hunter2" not in str(exc_info.value)


def test_database_url_is_masked_in_repr() -> None:
    settings = Settings(database_url=VALID_URL)
    assert "pw@" not in repr(settings)
    assert settings.default_timezone == "Asia/Kolkata"
