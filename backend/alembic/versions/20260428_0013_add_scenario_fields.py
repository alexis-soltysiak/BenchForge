"""add scenario fields

Revision ID: 20260428_0013
Revises: 20260422_0012
Create Date: 2026-04-28 12:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260428_0013"
down_revision = "20260422_0012"
branch_labels = None
depends_on = None


SCENARIO_CATEGORIES = [
    ("Code Debug", "code_debug", "Debugging scenarios with realistic code artifacts."),
    ("Code Review", "code_review", "Pull request review scenarios."),
    ("Refactor Constrained", "refactor_constrained", "Refactoring under explicit constraints."),
    ("Professional Writing", "professional_writing", "Client and business writing scenarios."),
    ("Document Synthesis", "document_synthesis", "Synthesis across source documents."),
    ("Product Reasoning", "product_reasoning", "Product and business trade-off scenarios."),
    ("Data Quality", "data_quality", "Structured data anomaly and validation scenarios."),
    ("Sensitive Communication", "sensitive_communication", "Diplomatic communication under risk constraints."),
    ("Creative Constrained", "creative_constrained", "Creative work with concrete business constraints."),
]

PROMPT_COLUMNS = [
    sa.Column("scenario_type", sa.String(length=80), nullable=True),
    sa.Column("objective", sa.Text(), nullable=True),
    sa.Column("context", sa.Text(), nullable=True),
    sa.Column("input_artifacts_jsonb", sa.JSON(), nullable=True),
    sa.Column("constraints_jsonb", sa.JSON(), nullable=True),
    sa.Column("expected_behavior_jsonb", sa.JSON(), nullable=True),
    sa.Column("gold_facts_jsonb", sa.JSON(), nullable=True),
    sa.Column("judge_rubric_jsonb", sa.JSON(), nullable=True),
    sa.Column("estimated_input_tokens", sa.Integer(), nullable=True),
    sa.Column("expected_output_format", sa.Text(), nullable=True),
    sa.Column("cost_tier", sa.String(length=32), nullable=True),
    sa.Column("weight", sa.Integer(), nullable=True),
    sa.Column("version", sa.String(length=64), nullable=True),
]


def upgrade() -> None:
    for column in PROMPT_COLUMNS:
        op.add_column("prompt", column.copy())
    for column in PROMPT_COLUMNS:
        op.add_column("session_run_prompt_snapshot", column.copy())
    op.add_column(
        "judge_evaluation_candidate",
        sa.Column("detailed_scores_jsonb", sa.JSON(), nullable=True),
    )

    prompt_category_table = sa.table(
        "prompt_category",
        sa.column("name", sa.String()),
        sa.column("slug", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("is_system", sa.Boolean()),
    )
    op.bulk_insert(
        prompt_category_table,
        [
            {"name": name, "slug": slug, "description": description, "is_system": True}
            for name, slug, description in SCENARIO_CATEGORIES
        ],
    )


def downgrade() -> None:
    op.drop_column("judge_evaluation_candidate", "detailed_scores_jsonb")
    for column in reversed(PROMPT_COLUMNS):
        op.drop_column("session_run_prompt_snapshot", column.name)
    for column in reversed(PROMPT_COLUMNS):
        op.drop_column("prompt", column.name)
