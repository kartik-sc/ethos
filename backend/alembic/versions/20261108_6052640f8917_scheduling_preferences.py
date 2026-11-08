"""scheduling preferences

Revision ID: 6052640f8917
Revises: 91365ca1e3fc
Create Date: 2026-11-08 08:22:57.573849
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6052640f8917"
down_revision: str | Sequence[str] | None = "91365ca1e3fc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "preferences",
        sa.Column("timezone", sa.String(length=64), server_default="Asia/Kolkata", nullable=False),
    )
    op.add_column(
        "preferences",
        sa.Column("default_task_minutes", sa.SmallInteger(), server_default="60", nullable=False),
    )
    op.add_column(
        "preferences", sa.Column("day_starts_at", sa.Time(), server_default="08:00", nullable=False)
    )
    op.add_column(
        "preferences", sa.Column("day_ends_at", sa.Time(), server_default="22:00", nullable=False)
    )
    op.create_check_constraint(
        op.f("ck_preferences_day_window"), "preferences", "day_starts_at < day_ends_at"
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_preferences_day_window"), "preferences", type_="check")
    op.drop_column("preferences", "day_ends_at")
    op.drop_column("preferences", "day_starts_at")
    op.drop_column("preferences", "default_task_minutes")
    op.drop_column("preferences", "timezone")
