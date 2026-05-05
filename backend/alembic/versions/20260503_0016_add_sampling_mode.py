"""add sampling mode to prompt and run prompt snapshot

Revision ID: 20260503_0016
Revises: 20260502_0015
Create Date: 2026-05-03 00:16:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260503_0016"
down_revision = "20260502_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prompt",
        sa.Column(
            "sampling_mode",
            sa.String(32),
            nullable=False,
            server_default="independent",
        ),
    )
    op.add_column(
        "session_run_prompt_snapshot",
        sa.Column(
            "sampling_mode",
            sa.String(32),
            nullable=False,
            server_default="independent",
        ),
    )


def downgrade() -> None:
    op.drop_column("session_run_prompt_snapshot", "sampling_mode")
    op.drop_column("prompt", "sampling_mode")
