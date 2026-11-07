"""habits

Revision ID: 1f53ccb3a361
Revises: 80af83f2926f
Create Date: 2026-11-07 19:11:50.889625
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "1f53ccb3a361"
down_revision: str | Sequence[str] | None = "80af83f2926f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "habits",
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
                name="habit_area",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column(
            "cadence",
            sa.Enum(
                "daily",
                "weekly",
                name="habit_cadence",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("weekdays", postgresql.ARRAY(sa.SmallInteger()), nullable=True),
        sa.Column("times_per_week", sa.SmallInteger(), nullable=True),
        sa.Column(
            "measure",
            sa.Enum(
                "check",
                "amount",
                "span",
                name="habit_measure",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("unit", sa.String(length=16), nullable=True),
        sa.Column("target_amount", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("protected", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("goal_id", sa.Uuid(), nullable=True),
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
            ["goal_id"], ["goals.id"], name=op.f("fk_habits_goal_id_goals"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_habits")),
    )
    op.create_index(op.f("ix_habits_goal_id"), "habits", ["goal_id"], unique=False)
    op.create_table(
        "habit_logs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("habit_id", sa.Uuid(), nullable=False),
        sa.Column("on_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["habit_id"],
            ["habits.id"],
            name=op.f("fk_habit_logs_habit_id_habits"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_habit_logs")),
        sa.UniqueConstraint("habit_id", "on_date", name=op.f("uq_habit_logs_habit_id")),
    )

    # The spec's one hard-coded starting point: the protected daily two-hour LeetCode habit.
    op.execute(
        """
        INSERT INTO habits
            (title, description, area, cadence, weekdays, measure, unit, target_amount, protected)
        VALUES
            ('LeetCode', 'Two hours every day. Recover the same day only; never shortened.',
             'career', 'daily', '{0,1,2,3,4,5,6}', 'amount', 'min', 120, true)
        """
    )


def downgrade() -> None:
    op.drop_table("habit_logs")
    op.drop_index(op.f("ix_habits_goal_id"), table_name="habits")
    op.drop_table("habits")
