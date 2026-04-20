from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.prompts.builtin_seed import BUILTIN_PROMPT_SEEDS
from app.features.prompts.models import Prompt, PromptCategory, PromptTag, PromptTagLink
from app.features.prompts.repository import PromptRepository
from app.features.prompts.schemas import (
    PromptCategoryRead,
    PromptCreate,
    PromptRead,
    PromptUpdate,
)

SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


class PromptCategoryNotFoundError(ValueError):
    pass


class PromptNotFoundError(ValueError):
    pass


def slugify(value: str) -> str:
    slug = SLUG_PATTERN.sub("-", value.strip().lower()).strip("-")
    return slug or "item"


async def build_unique_prompt_slug(
    repository: PromptRepository,
    base_value: str,
    current_prompt_id: int | None = None,
) -> str:
    base_slug = slugify(base_value)
    slug = base_slug
    suffix = 2

    while True:
        existing = await repository.get_prompt_by_slug(slug)
        if existing is None or existing.id == current_prompt_id:
            return slug
        slug = f"{base_slug}-{suffix}"
        suffix += 1


async def get_or_create_tags(
    repository: PromptRepository,
    tag_names: list[str],
) -> list[PromptTag]:
    resolved: list[PromptTag] = []
    seen_slugs: set[str] = set()

    for raw_name in tag_names:
        cleaned_name = raw_name.strip()
        if not cleaned_name:
            continue

        slug = slugify(cleaned_name)
        if slug in seen_slugs:
            continue

        tag = await repository.get_tag_by_slug(slug)
        if tag is None:
            tag = PromptTag(name=cleaned_name, slug=slug)
            repository.add_tag(tag)
            await repository.flush()

        seen_slugs.add(slug)
        resolved.append(tag)

    return resolved


def serialize_prompt(prompt: Prompt) -> PromptRead:
    return PromptRead(
        id=prompt.id,
        name=prompt.name,
        slug=prompt.slug,
        description=prompt.description,
        category=PromptCategoryRead.model_validate(prompt.category),
        system_prompt_text=prompt.system_prompt_text,
        user_prompt_text=prompt.user_prompt_text,
        evaluation_notes=prompt.evaluation_notes,
        tags=sorted(link.tag.name for link in prompt.tag_links),
        difficulty=prompt.difficulty,
        is_active=prompt.is_active,
        is_archived=prompt.is_archived,
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
    )


@dataclass
class PromptService:
    session: AsyncSession
    repository: PromptRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = PromptRepository(self.session)

    async def list_categories(self) -> Sequence[PromptCategory]:
        await self.ensure_builtin_prompts()
        return await self.repository.list_categories()

    async def list_prompts(
        self,
        include_archived: bool,
    ) -> tuple[list[PromptRead], int]:
        await self.ensure_builtin_prompts()
        prompts, total = await self.repository.list_prompts(include_archived)
        return [serialize_prompt(prompt) for prompt in prompts], total

    async def get_prompt(self, prompt_id: int) -> PromptRead:
        prompt = await self.repository.get_prompt(prompt_id)
        if prompt is None:
            raise PromptNotFoundError(f"Prompt {prompt_id} not found.")
        return serialize_prompt(prompt)

    async def create_prompt(self, payload: PromptCreate) -> PromptRead:
        category = await self.repository.get_category(payload.category_id)
        if category is None:
            raise PromptCategoryNotFoundError(
                f"Prompt category {payload.category_id} not found."
            )

        prompt = Prompt(
            name=payload.name.strip(),
            slug=await build_unique_prompt_slug(self.repository, payload.name),
            description=payload.description.strip() if payload.description else None,
            category_id=payload.category_id,
            system_prompt_text=payload.system_prompt_text,
            user_prompt_text=payload.user_prompt_text.strip(),
            evaluation_notes=payload.evaluation_notes,
            difficulty=payload.difficulty,
            is_active=payload.is_active,
            is_archived=False,
        )
        tags = await get_or_create_tags(self.repository, payload.tags)
        prompt.tag_links = [PromptTagLink(tag=tag) for tag in tags]
        self.repository.add_prompt(prompt)
        await self.repository.commit()
        refreshed = await self.repository.get_prompt(prompt.id)
        assert refreshed is not None
        return serialize_prompt(refreshed)

    async def update_prompt(self, prompt_id: int, payload: PromptUpdate) -> PromptRead:
        prompt = await self.repository.get_prompt(prompt_id)
        if prompt is None:
            raise PromptNotFoundError(f"Prompt {prompt_id} not found.")

        updates = payload.model_dump(exclude_unset=True)
        if "category_id" in updates:
            category = await self.repository.get_category(updates["category_id"])
            if category is None:
                raise PromptCategoryNotFoundError(
                    f"Prompt category {updates['category_id']} not found."
                )
            prompt.category_id = updates["category_id"]

        if "name" in updates and updates["name"] is not None:
            prompt.name = updates["name"].strip()
            prompt.slug = await build_unique_prompt_slug(
                self.repository,
                prompt.name,
                current_prompt_id=prompt.id,
            )
        if "description" in updates:
            prompt.description = (
                updates["description"].strip() if updates["description"] else None
            )
        if "system_prompt_text" in updates:
            prompt.system_prompt_text = updates["system_prompt_text"]
        if "user_prompt_text" in updates and updates["user_prompt_text"] is not None:
            prompt.user_prompt_text = updates["user_prompt_text"].strip()
        if "evaluation_notes" in updates:
            prompt.evaluation_notes = updates["evaluation_notes"]
        if "is_active" in updates and updates["is_active"] is not None:
            prompt.is_active = updates["is_active"]
        if "difficulty" in updates:
            prompt.difficulty = updates["difficulty"]
        if "tags" in updates and updates["tags"] is not None:
            tags = await get_or_create_tags(self.repository, updates["tags"])
            prompt.tag_links.clear()
            prompt.tag_links.extend(PromptTagLink(tag=tag) for tag in tags)

        await self.repository.commit()
        refreshed = await self.repository.get_prompt(prompt.id)
        assert refreshed is not None
        return serialize_prompt(refreshed)

    async def archive_prompt(self, prompt_id: int) -> PromptRead:
        prompt = await self.repository.get_prompt(prompt_id)
        if prompt is None:
            raise PromptNotFoundError(f"Prompt {prompt_id} not found.")

        prompt.is_archived = True
        prompt.is_active = False
        await self.repository.commit()
        refreshed = await self.repository.get_prompt(prompt.id)
        assert refreshed is not None
        return serialize_prompt(refreshed)

    async def ensure_builtin_prompts(self) -> int:
        seed_slugs = {seed.slug for seed in BUILTIN_PROMPT_SEEDS}

        all_prompts, _ = await self.repository.list_prompts(include_archived=True)
        for prompt in all_prompts:
            if prompt.slug not in seed_slugs:
                prompt.is_archived = True
                prompt.is_active = False

        created_count = 0

        for seed in BUILTIN_PROMPT_SEEDS:
            existing = await self.repository.get_prompt_by_slug(seed.slug)
            if existing is not None:
                existing.is_archived = False
                existing.is_active = True
                existing.name = seed.name
                existing.description = seed.description
                existing.system_prompt_text = seed.system_prompt_text
                existing.user_prompt_text = seed.user_prompt_text
                existing.evaluation_notes = seed.evaluation_notes
                existing.difficulty = seed.difficulty
                continue

            category = await self.repository.get_category_by_slug(seed.category_slug)
            if category is None:
                continue

            tags = await get_or_create_tags(self.repository, list(seed.tags))
            prompt = Prompt(
                name=seed.name,
                slug=seed.slug,
                description=seed.description,
                category_id=category.id,
                system_prompt_text=seed.system_prompt_text,
                user_prompt_text=seed.user_prompt_text,
                evaluation_notes=seed.evaluation_notes,
                difficulty=seed.difficulty,
                is_active=True,
                is_archived=False,
            )
            prompt.tag_links = [PromptTagLink(tag=tag) for tag in tags]
            self.repository.add_prompt(prompt)
            created_count += 1

        await self.repository.commit()
        return created_count
