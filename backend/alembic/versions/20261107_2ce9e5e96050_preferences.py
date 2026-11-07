"""preferences

Revision ID: 2ce9e5e96050
Revises: 940ca72572cb
Create Date: 2026-11-07 21:28:19.636405
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2ce9e5e96050"
down_revision: str | Sequence[str] | None = "940ca72572cb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "preferences",
        sa.Column("id", sa.SmallInteger(), nullable=False),
        sa.Column("archive_after_days", sa.SmallInteger(), server_default="30", nullable=False),
        sa.CheckConstraint("id = 1", name=op.f("ck_preferences_single_row")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_preferences")),
    )


def downgrade() -> None:
    op.drop_table("preferences")
