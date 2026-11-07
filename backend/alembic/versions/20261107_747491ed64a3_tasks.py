"""tasks

Revision ID: 747491ed64a3
Revises: 2311c8cba17d
Create Date: 2026-11-07 15:36:39.392592
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "747491ed64a3"
down_revision: str | Sequence[str] | None = "2311c8cba17d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "area",
            sa.Enum(
                "academics",
                "career",
                "personal",
                "health",
                "social",
                "learning",
                name="task_area",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "open",
                "done",
                "cancelled",
                name="task_status",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum(
                "low",
                "normal",
                "high",
                name="task_priority",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("planned_minutes", sa.SmallInteger(), nullable=True),
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
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(
        "ix_tasks_open_due",
        "tasks",
        ["due_date"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_table(
        "next_action_overrides",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("suggested_task_id", sa.Uuid(), nullable=True),
        sa.Column("chosen_task_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["chosen_task_id"],
            ["tasks.id"],
            name=op.f("fk_next_action_overrides_chosen_task_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["suggested_task_id"],
            ["tasks.id"],
            name=op.f("fk_next_action_overrides_suggested_task_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_next_action_overrides")),
    )
    op.create_index(
        op.f("ix_next_action_overrides_created_at"),
        "next_action_overrides",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_next_action_overrides_created_at"), table_name="next_action_overrides")
    op.drop_table("next_action_overrides")
    op.drop_index(
        "ix_tasks_open_due", table_name="tasks", postgresql_where=sa.text("deleted_at IS NULL")
    )
    op.drop_table("tasks")
