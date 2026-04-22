"""add estimated_cost to judge_batch

Revision ID: 20260422_0012
Revises: 20260420_0011
Create Date: 2026-04-22 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260422_0012"
down_revision = "20260420_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "judge_batch",
        sa.Column("estimated_cost", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("judge_batch", "estimated_cost")
