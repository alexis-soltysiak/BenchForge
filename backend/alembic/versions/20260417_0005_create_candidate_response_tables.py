"""create candidate response tables

Revision ID: 20260417_0005
Revises: 20260417_0004
Create Date: 2026-04-17 16:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260417_0005"
down_revision = "20260417_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "candidate_response",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("prompt_snapshot_id", sa.Integer(), nullable=False),
        sa.Column("model_snapshot_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("request_payload_jsonb", sa.Text(), nullable=True),
        sa.Column("raw_response_text", sa.Text(), nullable=True),
        sa.Column("normalized_response_text", sa.Text(), nullable=True),
        sa.Column("raw_response_jsonb", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["model_snapshot_id"],
            ["session_run_model_snapshot.id"],
            name=op.f("fk_candidate_response_model_snapshot_id_session_run_model_snapshot"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["prompt_snapshot_id"],
            ["session_run_prompt_snapshot.id"],
            name=op.f("fk_candidate_response_prompt_snapshot_id_session_run_prompt_snapshot"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["session_run.id"],
            name=op.f("fk_candidate_response_run_id_session_run"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_candidate_response")),
    )
    op.create_table(
        "response_metric",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("candidate_response_id", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("local_wait_ms", sa.Integer(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("tokens_per_second", sa.String(length=32), nullable=True),
        sa.Column("estimated_cost", sa.String(length=32), nullable=True),
        sa.Column("extra_metrics_jsonb", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["candidate_response_id"],
            ["candidate_response.id"],
            name=op.f("fk_response_metric_candidate_response_id_candidate_response"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_response_metric")),
    )


def downgrade() -> None:
    op.drop_table("response_metric")
    op.drop_table("candidate_response")
