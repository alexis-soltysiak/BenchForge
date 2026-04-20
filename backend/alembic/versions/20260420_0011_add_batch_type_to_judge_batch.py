"""add batch type to judge batch

Revision ID: 20260420_0011
Revises: 20260419_0010
Create Date: 2026-04-20 15:30:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260420_0011"
down_revision = "20260419_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "judge_batch",
        sa.Column(
            "batch_type",
            sa.String(length=32),
            server_default="absolute",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("judge_batch", "batch_type")
