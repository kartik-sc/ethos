"""integration tokens

Revision ID: 91365ca1e3fc
Revises: 508c04367bf9
Create Date: 2026-11-08 08:13:42.184262
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "91365ca1e3fc"
down_revision: str | Sequence[str] | None = "508c04367bf9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "integration_tokens",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("prefix", sa.String(length=12), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_integration_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_integration_tokens_token_hash")),
    )


def downgrade() -> None:
    op.drop_table("integration_tokens")
