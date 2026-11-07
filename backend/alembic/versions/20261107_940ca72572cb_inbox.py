"""inbox

Revision ID: 940ca72572cb
Revises: 1f53ccb3a361
Create Date: 2026-11-07 21:21:13.429550
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "940ca72572cb"
down_revision: str | Sequence[str] | None = "1f53ccb3a361"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "inbox_items",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=16), server_default="web", nullable=False),
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
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "outcome",
            sa.Enum(
                "task",
                "project",
                "goal",
                "done",
                "dismissed",
                name="inbox_outcome",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column("result_id", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inbox_items")),
    )
    op.create_index(
        "ix_inbox_items_open",
        "inbox_items",
        ["created_at"],
        unique=False,
        postgresql_where=sa.text("processed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_inbox_items_open",
        table_name="inbox_items",
        postgresql_where=sa.text("processed_at IS NULL"),
    )
    op.drop_table("inbox_items")
