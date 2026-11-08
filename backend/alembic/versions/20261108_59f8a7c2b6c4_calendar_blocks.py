"""calendar blocks

Revision ID: 59f8a7c2b6c4
Revises: 6052640f8917
Create Date: 2026-11-08 08:34:40.917485
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "59f8a7c2b6c4"
down_revision: str | Sequence[str] | None = "6052640f8917"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "calendar_blocks",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "task",
                "habit",
                "event",
                name="block_kind",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("habit_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "scheduled",
                "done",
                "missed",
                name="block_status",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("fixed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("recovers_id", sa.Uuid(), nullable=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column(
            "sync_op",
            sa.Enum(
                "create",
                "update",
                "delete",
                name="block_sync_op",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column("sync_error", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint("starts_at < ends_at", name=op.f("ck_calendar_blocks_ordered")),
        sa.ForeignKeyConstraint(
            ["habit_id"],
            ["habits.id"],
            name=op.f("fk_calendar_blocks_habit_id_habits"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recovers_id"],
            ["calendar_blocks.id"],
            name=op.f("fk_calendar_blocks_recovers_id_calendar_blocks"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            name=op.f("fk_calendar_blocks_task_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_calendar_blocks")),
        sa.UniqueConstraint("external_id", name=op.f("uq_calendar_blocks_external_id")),
    )
    op.create_index(
        op.f("ix_calendar_blocks_habit_id"), "calendar_blocks", ["habit_id"], unique=False
    )
    op.create_index(
        op.f("ix_calendar_blocks_starts_at"), "calendar_blocks", ["starts_at"], unique=False
    )
    op.create_index(
        op.f("ix_calendar_blocks_task_id"), "calendar_blocks", ["task_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_calendar_blocks_task_id"), table_name="calendar_blocks")
    op.drop_index(op.f("ix_calendar_blocks_starts_at"), table_name="calendar_blocks")
    op.drop_index(op.f("ix_calendar_blocks_habit_id"), table_name="calendar_blocks")
    op.drop_table("calendar_blocks")
