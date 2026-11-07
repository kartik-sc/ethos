"""quotes

Revision ID: ed85d16b6a15
Revises: 2ce9e5e96050
Create Date: 2026-11-07 21:35:13.308100
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "ed85d16b6a15"
down_revision: str | Sequence[str] | None = "2ce9e5e96050"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "quotes",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=200), nullable=True),
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
        sa.Column("last_shown_on", sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_quotes")),
    )


def downgrade() -> None:
    op.drop_table("quotes")
