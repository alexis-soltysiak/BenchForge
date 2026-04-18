"""create model global summary table

Revision ID: 20260417_0007
Revises: 20260417_0006
Create Date: 2026-04-17 20:15:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260417_0007"
down_revision = "20260417_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_global_summary",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("model_snapshot_id", sa.Integer(), nullable=False),
        sa.Column("average_overall_score", sa.String(length=32), nullable=False),
        sa.Column("average_relevance_score", sa.String(length=32), nullable=False),
        sa.Column("average_accuracy_score", sa.String(length=32), nullable=False),
        sa.Column("average_completeness_score", sa.String(length=32), nullable=False),
        sa.Column("average_clarity_score", sa.String(length=32), nullable=False),
        sa.Column(
            "average_instruction_following_score",
            sa.String(length=32),
            nullable=False,
        ),
        sa.Column("avg_duration_ms", sa.Integer(), nullable=True),
        sa.Column("avg_total_tokens", sa.Integer(), nullable=True),
        sa.Column("avg_tokens_per_second", sa.String(length=32), nullable=True),
        sa.Column("total_estimated_cost", sa.String(length=32), nullable=True),
        sa.Column("global_summary_text", sa.Text(), nullable=True),
        sa.Column("best_patterns_text", sa.Text(), nullable=True),
        sa.Column("weak_patterns_text", sa.Text(), nullable=True),
        sa.Column("final_global_score", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(
            ["model_snapshot_id"],
            ["session_run_model_snapshot.id"],
            name=op.f(
                "fk_model_global_summary_model_snapshot_id_session_run_model_snapshot"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["session_run.id"],
            name=op.f("fk_model_global_summary_run_id_session_run"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_model_global_summary")),
    )


def downgrade() -> None:
    op.drop_table("model_global_summary")
