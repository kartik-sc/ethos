import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, string_enum


class Folder(Base):
    __tablename__ = "note_folders"
    __table_args__ = (UniqueConstraint("parent_id", "name", postgresql_nulls_not_distinct=True),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    name: Mapped[str] = mapped_column(String(120))
    # Deleting a folder is only allowed when it is empty, so children never dangle.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("note_folders.id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


note_tags = Table(
    "note_tags",
    Base.metadata,
    Column("note_id", ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True, index=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    name: Mapped[str] = mapped_column(String(48), unique=True)


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        # Wiki-links resolve by title, so live titles are unique regardless of case.
        Index(
            "uq_notes_live_title",
            func.lower(text("title")),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, default="", server_default="")
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("note_folders.id", ondelete="RESTRICT"), index=True
    )
    # Bumped on every save; a save based on an older version is refused, never merged blindly.
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tags: Mapped[list[Tag]] = relationship(secondary=note_tags, lazy="selectin", order_by=Tag.name)
    folder: Mapped[Folder | None] = relationship(lazy="joined")


class NoteVersion(Base):
    """A snapshot of a note as saved. Close-together saves share one snapshot."""

    __tablename__ = "note_versions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    note_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LinkKind(StrEnum):
    NOTE = "note"
    TASK = "task"
    PROJECT = "project"
    GOAL = "goal"


class NoteLink(Base):
    """One `[[...]]` in a note. Resolved by id, so renaming the target does not break it."""

    __tablename__ = "note_links"
    __table_args__ = (UniqueConstraint("source_id", "label"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("uuidv7()"))
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), index=True
    )
    # The text inside the brackets, e.g. "Graph theory" or "task:Renew passport".
    label: Mapped[str] = mapped_column(String(220))
    kind: Mapped[LinkKind] = mapped_column(string_enum(LinkKind, "note_link_kind"))
    # Null while nothing matches the label; filled in when a matching record appears.
    target_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
