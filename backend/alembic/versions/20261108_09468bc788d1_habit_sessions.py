"""habit sessions

Revision ID: 09468bc788d1
Revises: 59f8a7c2b6c4
Create Date: 2026-11-08 08:51:53.185476
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "09468bc788d1"
down_revision: str | Sequence[str] | None = "59f8a7c2b6c4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


STATUS_CHECK = op.f("ck_calendar_blocks_block_status")


def upgrade() -> None:
    op.add_column("habits", sa.Column("session_minutes", sa.SmallInteger(), nullable=True))
    op.add_column("habits", sa.Column("session_time", sa.Time(), nullable=True))
    # The protected LeetCode habit gets its two-hour session.
    op.execute("UPDATE habits SET session_minutes = 120 WHERE protected AND title = 'LeetCode'")
    op.drop_constraint(STATUS_CHECK, "calendar_blocks", type_="check")
    op.create_check_constraint(
        STATUS_CHECK,
        "calendar_blocks",
        "status IN ('scheduled', 'done', 'missed', 'cancelled')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM calendar_blocks WHERE status = 'cancelled'")
    op.drop_constraint(STATUS_CHECK, "calendar_blocks", type_="check")
    op.create_check_constraint(
        STATUS_CHECK, "calendar_blocks", "status IN ('scheduled', 'done', 'missed')"
    )
    op.drop_column("habits", "session_time")
    op.drop_column("habits", "session_minutes")
