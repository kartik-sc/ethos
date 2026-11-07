"""projects

Revision ID: 1aaa507a57d0
Revises: 747491ed64a3
Create Date: 2026-11-07 17:38:34.722275
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "1aaa507a57d0"
down_revision: str | Sequence[str] | None = "747491ed64a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
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
                name="project_area",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.add_column("tasks", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_tasks_project_id"), "tasks", ["project_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_tasks_project_id_projects"),
        "tasks",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_tasks_project_id_projects"), "tasks", type_="foreignkey")
    op.drop_index(op.f("ix_tasks_project_id"), table_name="tasks")
    op.drop_column("tasks", "project_id")
    op.drop_table("projects")
