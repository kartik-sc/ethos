"""goals

Revision ID: 80af83f2926f
Revises: 1aaa507a57d0
Create Date: 2026-11-07 18:40:23.088882
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "80af83f2926f"
down_revision: str | Sequence[str] | None = "1aaa507a57d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goals",
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
                name="goal_area",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column("target_date", sa.Date(), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goals")),
    )
    op.add_column("projects", sa.Column("goal_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_projects_goal_id"), "projects", ["goal_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_projects_goal_id_goals"),
        "projects",
        "goals",
        ["goal_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("tasks", sa.Column("goal_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_tasks_goal_id"), "tasks", ["goal_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_tasks_goal_id_goals"), "tasks", "goals", ["goal_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_tasks_goal_id_goals"), "tasks", type_="foreignkey")
    op.drop_index(op.f("ix_tasks_goal_id"), table_name="tasks")
    op.drop_column("tasks", "goal_id")
    op.drop_constraint(op.f("fk_projects_goal_id_goals"), "projects", type_="foreignkey")
    op.drop_index(op.f("ix_projects_goal_id"), table_name="projects")
    op.drop_column("projects", "goal_id")
    op.drop_table("goals")
