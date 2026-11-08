import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class IntegrationToken(Base):
    """A revocable credential for a capture client such as an iPhone Shortcut.

    It can only add captures; it is not a login. Only a SHA-256 of the secret is stored.
    """

    __tablename__ = "integration_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    name: Mapped[str] = mapped_column(String(80))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # The first characters of the secret, so the owner can tell tokens apart.
    prefix: Mapped[str] = mapped_column(String(12))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
