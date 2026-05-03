"""add sample index to candidate response

Revision ID: 20260502_0015
Revises: 20260501_0014
Create Date: 2026-05-02 00:15:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260502_0015"
down_revision = "20260501_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "candidate_response",
        sa.Column("sample_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_cr_prompt_model_sample",
        "candidate_response",
        ["prompt_snapshot_id", "model_snapshot_id", "sample_index"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_cr_prompt_model_sample", table_name="candidate_response")
    op.drop_column("candidate_response", "sample_index")
