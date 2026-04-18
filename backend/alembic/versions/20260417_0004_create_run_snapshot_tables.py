"""create run snapshot tables

Revision ID: 20260417_0004
Revises: 20260417_0003
Create Date: 2026-04-17 15:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260417_0004"
down_revision = "20260417_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "session_run",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("launched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rubric_version", sa.String(length=64), nullable=False),
        sa.Column("report_status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("html_report_path", sa.Text(), nullable=True),
        sa.Column("pdf_report_path", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["benchmark_session.id"],
            name=op.f("fk_session_run_session_id_benchmark_session"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_run")),
    )
    op.create_table(
        "session_run_prompt_snapshot",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("source_prompt_id", sa.Integer(), nullable=False),
        sa.Column("source_prompt_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category_name", sa.String(length=120), nullable=False),
        sa.Column("system_prompt_text", sa.Text(), nullable=True),
        sa.Column("user_prompt_text", sa.Text(), nullable=False),
        sa.Column("evaluation_notes", sa.Text(), nullable=True),
        sa.Column("snapshot_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["session_run.id"],
            name=op.f("fk_session_run_prompt_snapshot_run_id_session_run"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_run_prompt_snapshot")),
    )
    op.create_table(
        "session_run_model_snapshot",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("source_model_profile_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("provider_type", sa.String(length=64), nullable=False),
        sa.Column("api_style", sa.String(length=64), nullable=False),
        sa.Column("runtime_type", sa.String(length=32), nullable=False),
        sa.Column("machine_label", sa.String(length=200), nullable=True),
        sa.Column("endpoint_url", sa.String(length=500), nullable=False),
        sa.Column("model_identifier", sa.String(length=255), nullable=False),
        sa.Column("timeout_seconds", sa.Integer(), nullable=False),
        sa.Column("context_window", sa.Integer(), nullable=True),
        sa.Column("pricing_input_per_million", sa.String(length=32), nullable=True),
        sa.Column("pricing_output_per_million", sa.String(length=32), nullable=True),
        sa.Column("local_load_instructions", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["session_run.id"],
            name=op.f("fk_session_run_model_snapshot_run_id_session_run"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_run_model_snapshot")),
    )


def downgrade() -> None:
    op.drop_table("session_run_model_snapshot")
    op.drop_table("session_run_prompt_snapshot")
    op.drop_table("session_run")
