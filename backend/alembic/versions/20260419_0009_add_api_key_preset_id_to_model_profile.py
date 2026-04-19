"""add api key preset id to model profile

Revision ID: 20260419_0009
Revises: 20260419_0008
Create Date: 2026-04-19 18:00:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260419_0009"
down_revision = "20260419_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "model_profile",
        sa.Column("api_key_preset_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("model_profile", "api_key_preset_id")
