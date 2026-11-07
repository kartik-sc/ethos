from functools import lru_cache
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    environment: Environment = "development"
    log_level: LogLevel = "INFO"
    database_url: SecretStr
    default_timezone: str = "Asia/Kolkata"
    worker_heartbeat_seconds: int = Field(default=30, ge=5, le=300)

    @field_validator("database_url")
    @classmethod
    def require_psycopg_driver(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith("postgresql+psycopg://"):
            raise ValueError("must use the postgresql+psycopg:// scheme")
        return value

    @field_validator("default_timezone")
    @classmethod
    def require_known_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError(f"unknown IANA timezone: {value}") from exc
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
