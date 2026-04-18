"""create prompt library tables

Revision ID: 20260417_0001
Revises:
Create Date: 2026-04-17 12:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260417_0001"
down_revision = None
branch_labels = None
depends_on = None


PROMPT_CATEGORIES = [
    {
        "name": "General QA",
        "slug": "general-qa",
        "description": "General question answering and explanatory prompts.",
    },
    {
        "name": "Summarization",
        "slug": "summarization",
        "description": "Short and long-form summarization prompts.",
    },
    {
        "name": "Structured Output",
        "slug": "structured-output",
        "description": "Prompts that require strict schema-constrained output.",
    },
    {
        "name": "Classification",
        "slug": "classification",
        "description": "Single-label and multi-label classification prompts.",
    },
    {
        "name": "Writing",
        "slug": "writing",
        "description": "Style transfer, drafting, and text rewriting prompts.",
    },
    {
        "name": "Translation",
        "slug": "translation",
        "description": "Translation and localization prompts.",
    },
    {
        "name": "Reasoning",
        "slug": "reasoning",
        "description": "Prompts that emphasize multi-step reasoning.",
    },
    {
        "name": "Coding",
        "slug": "coding",
        "description": "Code generation and code reasoning prompts.",
    },
]


def upgrade() -> None:
    op.create_table(
        "prompt_category",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prompt_category")),
        sa.UniqueConstraint("name", name=op.f("uq_prompt_category_name")),
        sa.UniqueConstraint("slug", name=op.f("uq_prompt_category_slug")),
    )
    op.create_table(
        "prompt_tag",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prompt_tag")),
        sa.UniqueConstraint("name", name=op.f("uq_prompt_tag_name")),
        sa.UniqueConstraint("slug", name=op.f("uq_prompt_tag_slug")),
    )
    op.create_table(
        "prompt",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("system_prompt_text", sa.Text(), nullable=True),
        sa.Column("user_prompt_text", sa.Text(), nullable=False),
        sa.Column("evaluation_notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["prompt_category.id"],
            name=op.f("fk_prompt_category_id_prompt_category"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prompt")),
        sa.UniqueConstraint("slug", name=op.f("uq_prompt_slug")),
    )
    op.create_table(
        "prompt_tag_link",
        sa.Column("prompt_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["prompt_id"],
            ["prompt.id"],
            name=op.f("fk_prompt_tag_link_prompt_id_prompt"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["prompt_tag.id"],
            name=op.f("fk_prompt_tag_link_tag_id_prompt_tag"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("prompt_id", "tag_id", name=op.f("pk_prompt_tag_link")),
        sa.UniqueConstraint("prompt_id", "tag_id", name="uq_prompt_tag_link_prompt_id_tag_id"),
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
        [{**item, "is_system": True} for item in PROMPT_CATEGORIES],
    )


def downgrade() -> None:
    op.drop_table("prompt_tag_link")
    op.drop_table("prompt")
    op.drop_table("prompt_tag")
    op.drop_table("prompt_category")
