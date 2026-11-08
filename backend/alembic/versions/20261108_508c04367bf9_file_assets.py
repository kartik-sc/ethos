"""file assets

Revision ID: 508c04367bf9
Revises: b48649ef2d14
Create Date: 2026-11-08 08:01:01.641348
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "508c04367bf9"
down_revision: str | Sequence[str] | None = "b48649ef2d14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "file_assets",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.String(length=200), nullable=False),
        sa.Column("content_type", sa.String(length=200), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("storage_key", sa.String(length=64), nullable=False),
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
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_file_assets_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_file_assets")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_file_assets_storage_key")),
    )
    op.create_index(op.f("ix_file_assets_project_id"), "file_assets", ["project_id"], unique=False)
    op.create_index(
        "uq_file_assets_live_name",
        "file_assets",
        ["project_id", sa.literal_column("lower(filename)")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_file_assets_live_name",
        table_name="file_assets",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(op.f("ix_file_assets_project_id"), table_name="file_assets")
    op.drop_table("file_assets")
