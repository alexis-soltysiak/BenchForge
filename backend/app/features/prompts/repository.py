from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import Select, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.prompts.models import Prompt, PromptCategory, PromptTag, PromptTagLink


class PromptRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_categories(self) -> Sequence[PromptCategory]:
        query = select(PromptCategory).order_by(PromptCategory.name.asc())
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_category(self, category_id: int) -> PromptCategory | None:
        return await self.session.get(PromptCategory, category_id)

    async def get_category_by_slug(self, slug: str) -> PromptCategory | None:
        query = select(PromptCategory).where(PromptCategory.slug == slug)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_prompts(
        self,
        include_archived: bool,
    ) -> tuple[Sequence[Prompt], int]:
        query: Select[tuple[Prompt]] = (
            select(Prompt)
            .options(
                selectinload(Prompt.category),
                selectinload(Prompt.tag_links).selectinload(PromptTagLink.tag),
            )
            .order_by(Prompt.updated_at.desc(), Prompt.id.desc())
        )
        count_query = select(func.count(Prompt.id))
        if not include_archived:
            query = query.where(Prompt.is_archived.is_(False))
            count_query = count_query.where(Prompt.is_archived.is_(False))

        items_result = await self.session.execute(query)
        count_result = await self.session.execute(count_query)
        return items_result.scalars().all(), int(count_result.scalar_one())

    async def get_prompt(self, prompt_id: int) -> Prompt | None:
        query = (
            select(Prompt)
            .where(Prompt.id == prompt_id)
            .options(
                selectinload(Prompt.category),
                selectinload(Prompt.tag_links).selectinload(PromptTagLink.tag),
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_prompt_by_slug(self, slug: str) -> Prompt | None:
        query = select(Prompt).where(Prompt.slug == slug)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_tag_by_slug(self, slug: str) -> PromptTag | None:
        query = select(PromptTag).where(PromptTag.slug == slug)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    def add_prompt(self, prompt: Prompt) -> None:
        self.session.add(prompt)

    def add_tag(self, tag: PromptTag) -> None:
        self.session.add(tag)

    async def flush(self) -> None:
        await self.session.flush()

    async def commit(self) -> None:
        await self.session.commit()

    async def refresh_prompt(self, prompt: Prompt) -> None:
        await self.session.refresh(
            prompt,
            attribute_names=["category", "tag_links"],
        )

    async def delete_all_prompts(self) -> None:
        from sqlalchemy import update

        await self.session.execute(
            update(Prompt).values(is_archived=True, is_active=False)
        )
        await self.session.commit()
