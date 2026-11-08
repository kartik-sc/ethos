"""calendar sync attempts

Revision ID: 7e5414e0af0e
Revises: 09468bc788d1
Create Date: 2026-11-08 11:05:12.458896
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7e5414e0af0e"
down_revision: str | Sequence[str] | None = "09468bc788d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "calendar_blocks",
        sa.Column("sync_attempts", sa.SmallInteger(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("calendar_blocks", "sync_attempts")
