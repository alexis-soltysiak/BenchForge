"""add difficulty to prompt

Revision ID: 20260419_0010
Revises: 20260419_0009
Create Date: 2026-04-19 12:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260419_0010"
down_revision = "20260419_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prompt",
        sa.Column("difficulty", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prompt", "difficulty")
