"""notes

Revision ID: b48649ef2d14
Revises: ed85d16b6a15
Create Date: 2026-11-07 21:57:46.994483
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b48649ef2d14"
down_revision: str | Sequence[str] | None = "ed85d16b6a15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "note_folders",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["note_folders.id"],
            name=op.f("fk_note_folders_parent_id_note_folders"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_note_folders")),
        sa.UniqueConstraint(
            "parent_id",
            "name",
            name=op.f("uq_note_folders_parent_id"),
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index(op.f("ix_note_folders_parent_id"), "note_folders", ["parent_id"], unique=False)
    op.create_table(
        "tags",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("name", sa.String(length=48), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tags")),
        sa.UniqueConstraint("name", name=op.f("uq_tags_name")),
    )
    op.create_table(
        "notes",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), server_default="", nullable=False),
        sa.Column("folder_id", sa.Uuid(), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["folder_id"],
            ["note_folders.id"],
            name=op.f("fk_notes_folder_id_note_folders"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notes")),
    )
    op.create_index(op.f("ix_notes_folder_id"), "notes", ["folder_id"], unique=False)
    op.create_index(
        "uq_notes_live_title",
        "notes",
        [sa.literal_column("lower(title)")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_table(
        "note_links",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=220), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "note",
                "task",
                "project",
                "goal",
                name="note_link_kind",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("target_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["notes.id"],
            name=op.f("fk_note_links_source_id_notes"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_note_links")),
        sa.UniqueConstraint("source_id", "label", name=op.f("uq_note_links_source_id")),
    )
    op.create_index(op.f("ix_note_links_source_id"), "note_links", ["source_id"], unique=False)
    op.create_index(op.f("ix_note_links_target_id"), "note_links", ["target_id"], unique=False)
    op.create_table(
        "note_tags",
        sa.Column("note_id", sa.Uuid(), nullable=False),
        sa.Column("tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["note_id"], ["notes.id"], name=op.f("fk_note_tags_note_id_notes"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"], ["tags.id"], name=op.f("fk_note_tags_tag_id_tags"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("note_id", "tag_id", name=op.f("pk_note_tags")),
    )
    op.create_index(op.f("ix_note_tags_tag_id"), "note_tags", ["tag_id"], unique=False)
    op.create_table(
        "note_versions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("note_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "saved_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["note_id"],
            ["notes.id"],
            name=op.f("fk_note_versions_note_id_notes"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_note_versions")),
    )
    op.create_index(op.f("ix_note_versions_note_id"), "note_versions", ["note_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_note_versions_note_id"), table_name="note_versions")
    op.drop_table("note_versions")
    op.drop_index(op.f("ix_note_tags_tag_id"), table_name="note_tags")
    op.drop_table("note_tags")
    op.drop_index(op.f("ix_note_links_target_id"), table_name="note_links")
    op.drop_index(op.f("ix_note_links_source_id"), table_name="note_links")
    op.drop_table("note_links")
    op.drop_index(
        "uq_notes_live_title", table_name="notes", postgresql_where=sa.text("deleted_at IS NULL")
    )
    op.drop_index(op.f("ix_notes_folder_id"), table_name="notes")
    op.drop_table("notes")
    op.drop_table("tags")
    op.drop_index(op.f("ix_note_folders_parent_id"), table_name="note_folders")
    op.drop_table("note_folders")
