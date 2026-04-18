"""create session tables

Revision ID: 20260417_0003
Revises: 20260417_0002
Create Date: 2026-04-17 14:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260417_0003"
down_revision = "20260417_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "benchmark_session",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="draft", nullable=False),
        sa.Column("max_candidates", sa.Integer(), server_default="5", nullable=False),
        sa.Column("rubric_version", sa.String(length=64), server_default="mvp-v1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_benchmark_session")),
    )
    op.create_table(
        "benchmark_session_prompt",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("prompt_id", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["prompt_id"],
            ["prompt.id"],
            name=op.f("fk_benchmark_session_prompt_prompt_id_prompt"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["benchmark_session.id"],
            name=op.f("fk_benchmark_session_prompt_session_id_benchmark_session"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_benchmark_session_prompt")),
        sa.UniqueConstraint("session_id", "prompt_id", name="uq_session_prompt_session_id_prompt_id"),
    )
    op.create_table(
        "benchmark_session_candidate",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("model_profile_id", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["model_profile_id"],
            ["model_profile.id"],
            name=op.f("fk_benchmark_session_candidate_model_profile_id_model_profile"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["benchmark_session.id"],
            name=op.f("fk_benchmark_session_candidate_session_id_benchmark_session"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_benchmark_session_candidate")),
        sa.UniqueConstraint(
            "session_id",
            "model_profile_id",
            name="uq_session_candidate_session_id_model_profile_id",
        ),
    )
    op.create_table(
        "benchmark_session_judge",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("model_profile_id", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["model_profile_id"],
            ["model_profile.id"],
            name=op.f("fk_benchmark_session_judge_model_profile_id_model_profile"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["benchmark_session.id"],
            name=op.f("fk_benchmark_session_judge_session_id_benchmark_session"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_benchmark_session_judge")),
        sa.UniqueConstraint(
            "session_id",
            "model_profile_id",
            name="uq_session_judge_session_id_model_profile_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("benchmark_session_judge")
    op.drop_table("benchmark_session_candidate")
    op.drop_table("benchmark_session_prompt")
    op.drop_table("benchmark_session")
