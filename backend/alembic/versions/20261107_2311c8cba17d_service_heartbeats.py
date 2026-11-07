"""service heartbeats

Revision ID: 2311c8cba17d
Revises:
Create Date: 2026-11-07 13:13:55.174301
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2311c8cba17d"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "service_heartbeats",
        sa.Column("service", sa.String(length=64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("service", name=op.f("pk_service_heartbeats")),
    )


def downgrade() -> None:
    op.drop_table("service_heartbeats")
