"""drop block sync update

Blocks are never edited in place, so no outbox entry ever held `update`. Refuse to narrow the
constraint if one does, rather than silently losing a pending change.

Revision ID: b3d91c4e27a0
Revises: 7e5414e0af0e
Create Date: 2026-11-08 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b3d91c4e27a0"
down_revision: str | Sequence[str] | None = "7e5414e0af0e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The naming convention in app.core.db prefixes this to ck_calendar_blocks_block_sync_op.
CONSTRAINT = "block_sync_op"


def upgrade() -> None:
    pending = (
        op.get_bind()
        .execute(sa.text("SELECT count(*) FROM calendar_blocks WHERE sync_op = 'update'"))
        .scalar_one()
    )
    if pending:
        raise RuntimeError(f"{pending} calendar block(s) hold a pending update; resolve first")
    op.drop_constraint(CONSTRAINT, "calendar_blocks", type_="check")
    op.create_check_constraint(
        CONSTRAINT,
        "calendar_blocks",
        "sync_op IN ('create', 'delete') OR sync_op IS NULL",
    )


def downgrade() -> None:
    op.drop_constraint(CONSTRAINT, "calendar_blocks", type_="check")
    op.create_check_constraint(
        CONSTRAINT,
        "calendar_blocks",
        "sync_op IN ('create', 'update', 'delete') OR sync_op IS NULL",
    )
