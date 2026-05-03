"""add code generation

Revision ID: 20260501_0014
Revises: 20260428_0013
Create Date: 2026-05-01 00:14:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260501_0014"
down_revision = "20260428_0013"
branch_labels = None
depends_on = None


CODE_GENERATION_CATEGORY = [
    ("Code Generation", "code_generation", "Code generation prompts with unit-test-based execution scoring."),
]

PROMPT_COLUMNS = [
    sa.Column("test_cases_visible_jsonb", sa.JSON(), nullable=True),
    sa.Column("test_cases_hidden_jsonb", sa.JSON(), nullable=True),
]

CANDIDATE_RESPONSE_COLUMNS = [
    sa.Column("execution_tier", sa.Integer(), nullable=True),
]


def upgrade() -> None:
    for column in PROMPT_COLUMNS:
        op.add_column("prompt", column.copy())
    for column in PROMPT_COLUMNS:
        op.add_column("session_run_prompt_snapshot", column.copy())
    for column in CANDIDATE_RESPONSE_COLUMNS:
        op.add_column("candidate_response", column.copy())

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
            for name, slug, description in CODE_GENERATION_CATEGORY
        ],
    )


def downgrade() -> None:
    # Precondition: all prompts using category_slug='code_generation' must be
    # deleted or re-categorised first; prompt.category_id has ondelete=RESTRICT.
    op.execute(sa.text("DELETE FROM prompt_category WHERE slug = 'code_generation'"))
    for column in reversed(CANDIDATE_RESPONSE_COLUMNS):
        op.drop_column("candidate_response", column.name)
    for column in reversed(PROMPT_COLUMNS):
        op.drop_column("session_run_prompt_snapshot", column.name)
    for column in reversed(PROMPT_COLUMNS):
        op.drop_column("prompt", column.name)
