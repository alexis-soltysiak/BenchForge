from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import Base, CreatedAtMixin, TimestampMixin


class PromptCategory(Base, CreatedAtMixin):
    __tablename__ = "prompt_category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    prompts: Mapped[list[Prompt]] = relationship(back_populates="category")


class PromptTag(Base, CreatedAtMixin):
    __tablename__ = "prompt_tag"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)

    prompt_links: Mapped[list[PromptTagLink]] = relationship(back_populates="tag")


class PromptTagLink(Base):
    __tablename__ = "prompt_tag_link"
    __table_args__ = (
        UniqueConstraint("prompt_id", "tag_id", name="uq_prompt_tag_link_prompt_id_tag_id"),
    )

    prompt_id: Mapped[int] = mapped_column(
        ForeignKey("prompt.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("prompt_tag.id", ondelete="CASCADE"),
        primary_key=True,
    )

    prompt: Mapped[Prompt] = relationship(back_populates="tag_links")
    tag: Mapped[PromptTag] = relationship(back_populates="prompt_links")


class Prompt(Base, TimestampMixin):
    __tablename__ = "prompt"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("prompt_category.id", ondelete="RESTRICT"),
        nullable=False,
    )
    system_prompt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    evaluation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    category: Mapped[PromptCategory] = relationship(back_populates="prompts")
    tag_links: Mapped[list[PromptTagLink]] = relationship(
        back_populates="prompt",
        cascade="all, delete-orphan",
    )
