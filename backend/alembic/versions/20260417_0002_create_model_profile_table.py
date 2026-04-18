"""create model profile table

Revision ID: 20260417_0002
Revises: 20260417_0001
Create Date: 2026-04-17 13:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260417_0002"
down_revision = "20260417_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_profile",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=240), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("provider_type", sa.String(length=64), nullable=False),
        sa.Column("api_style", sa.String(length=64), nullable=False),
        sa.Column("runtime_type", sa.String(length=32), nullable=False),
        sa.Column("machine_label", sa.String(length=200), nullable=True),
        sa.Column("endpoint_url", sa.String(length=500), nullable=False),
        sa.Column("model_identifier", sa.String(length=255), nullable=False),
        sa.Column("secret_encrypted", sa.Text(), nullable=True),
        sa.Column("timeout_seconds", sa.Integer(), server_default="60", nullable=False),
        sa.Column("context_window", sa.Integer(), nullable=True),
        sa.Column("pricing_input_per_million", sa.Numeric(12, 4), nullable=True),
        sa.Column("pricing_output_per_million", sa.Numeric(12, 4), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("local_load_instructions", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_model_profile")),
        sa.UniqueConstraint("slug", name=op.f("uq_model_profile_slug")),
    )


def downgrade() -> None:
    op.drop_table("model_profile")
