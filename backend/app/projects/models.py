import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, string_enum
from app.core.life_areas import LifeArea


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    area: Mapped[LifeArea | None] = mapped_column(string_enum(LifeArea, "project_area"))
    due_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
