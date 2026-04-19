"""create api key preset table

Revision ID: 20260419_0008
Revises: 20260417_0007
Create Date: 2026-04-19 12:00:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260419_0008"
down_revision = "20260417_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_key_preset",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("provider_type", sa.String(length=64), nullable=False),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_api_key_preset")),
    )


def downgrade() -> None:
    op.drop_table("api_key_preset")
