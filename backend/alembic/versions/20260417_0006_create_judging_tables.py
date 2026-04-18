"""create judging tables

Revision ID: 20260417_0006
Revises: 20260417_0005
Create Date: 2026-04-17 18:30:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260417_0006"
down_revision = "20260417_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "judge_batch",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("prompt_snapshot_id", sa.Integer(), nullable=False),
        sa.Column("judge_model_snapshot_id", sa.Integer(), nullable=False),
        sa.Column("batch_index", sa.Integer(), server_default="1", nullable=False),
        sa.Column("randomized_candidate_ids_jsonb", sa.Text(), nullable=False),
        sa.Column("request_payload_jsonb", sa.Text(), nullable=True),
        sa.Column("raw_response_text", sa.Text(), nullable=True),
        sa.Column("raw_response_jsonb", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["judge_model_snapshot_id"],
            ["session_run_model_snapshot.id"],
            name=op.f("fk_judge_batch_judge_model_snapshot_id_session_run_model_snapshot"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["prompt_snapshot_id"],
            ["session_run_prompt_snapshot.id"],
            name=op.f("fk_judge_batch_prompt_snapshot_id_session_run_prompt_snapshot"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["session_run.id"],
            name=op.f("fk_judge_batch_run_id_session_run"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_judge_batch")),
    )
    op.create_table(
        "judge_evaluation",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("judge_batch_id", sa.Integer(), nullable=False),
        sa.Column("parsed_output_jsonb", sa.Text(), nullable=False),
        sa.Column("schema_version", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["judge_batch_id"],
            ["judge_batch.id"],
            name=op.f("fk_judge_evaluation_judge_batch_id_judge_batch"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_judge_evaluation")),
    )
    op.create_table(
        "judge_evaluation_candidate",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("judge_evaluation_id", sa.Integer(), nullable=False),
        sa.Column("candidate_response_id", sa.Integer(), nullable=False),
        sa.Column("anonymized_candidate_label", sa.String(length=16), nullable=False),
        sa.Column("overall_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("relevance_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("accuracy_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("completeness_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("clarity_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("instruction_following_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("ranking_in_batch", sa.Integer(), nullable=False),
        sa.Column("strengths_text", sa.Text(), nullable=True),
        sa.Column("weaknesses_text", sa.Text(), nullable=True),
        sa.Column("short_feedback", sa.Text(), nullable=True),
        sa.Column("detailed_feedback", sa.Text(), nullable=True),
        sa.Column("judge_confidence_score", sa.Numeric(5, 2), nullable=True),
        sa.ForeignKeyConstraint(
            ["candidate_response_id"],
            ["candidate_response.id"],
            name=op.f("fk_judge_evaluation_candidate_candidate_response_id_candidate_response"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["judge_evaluation_id"],
            ["judge_evaluation.id"],
            name=op.f("fk_judge_evaluation_candidate_judge_evaluation_id_judge_evaluation"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_judge_evaluation_candidate")),
    )


def downgrade() -> None:
    op.drop_table("judge_evaluation_candidate")
    op.drop_table("judge_evaluation")
    op.drop_table("judge_batch")
