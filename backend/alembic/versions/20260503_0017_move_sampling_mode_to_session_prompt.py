"""move sampling_mode from prompt to benchmark_session_prompt

Revision ID: 20260503_0017
Revises: 20260503_0016
Create Date: 2026-05-03 00:17:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260503_0017"
down_revision = "20260503_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("prompt", "sampling_mode")
    op.add_column(
        "benchmark_session_prompt",
        sa.Column(
            "sampling_mode",
            sa.String(32),
            nullable=False,
            server_default="independent",
        ),
    )


def downgrade() -> None:
    op.drop_column("benchmark_session_prompt", "sampling_mode")
    op.add_column(
        "prompt",
        sa.Column(
            "sampling_mode",
            sa.String(32),
            nullable=False,
            server_default="independent",
        ),
    )
