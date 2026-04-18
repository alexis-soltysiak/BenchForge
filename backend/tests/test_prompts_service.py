from types import SimpleNamespace

import pytest

from app.features.prompts.builtin_seed import BUILTIN_PROMPT_SEEDS
from app.features.prompts.models import PromptTag
from app.features.prompts.service import (
    PromptCategoryNotFoundError,
    PromptNotFoundError,
    PromptService,
    slugify,
)


def test_slugify_normalizes_values() -> None:
    assert slugify("  General QA Prompt  ") == "general-qa-prompt"
    assert slugify("###") == "item"


@pytest.mark.asyncio
async def test_get_prompt_raises_when_missing() -> None:
    service = PromptService(SimpleNamespace())

    class MissingRepository:
        async def get_prompt(self, prompt_id: int):
            return None

    service.repository = MissingRepository()

    with pytest.raises(PromptNotFoundError):
        await service.get_prompt(123)


@pytest.mark.asyncio
async def test_create_prompt_raises_when_category_missing() -> None:
    service = PromptService(SimpleNamespace())

    class MissingCategoryRepository:
        async def get_category(self, category_id: int):
            return None

    service.repository = MissingCategoryRepository()

    with pytest.raises(PromptCategoryNotFoundError):
        await service.create_prompt(
            SimpleNamespace(
                category_id=999,
                name="Example",
                description=None,
                system_prompt_text=None,
                user_prompt_text="Hello",
                evaluation_notes=None,
                tags=[],
                is_active=True,
            )
        )


@pytest.mark.asyncio
async def test_ensure_builtin_prompts_is_idempotent() -> None:
    service = PromptService(SimpleNamespace())

    class SeedRepository:
        def __init__(self) -> None:
            self.categories = {
                "general-qa": SimpleNamespace(id=1),
                "summarization": SimpleNamespace(id=2),
                "structured-output": SimpleNamespace(id=3),
                "classification": SimpleNamespace(id=4),
                "writing": SimpleNamespace(id=5),
                "translation": SimpleNamespace(id=6),
                "reasoning": SimpleNamespace(id=7),
                "coding": SimpleNamespace(id=8),
            }
            self.prompts: dict[str, SimpleNamespace] = {}
            self.tags: dict[str, PromptTag] = {}
            self.next_tag_id = 1
            self.commits = 0

        async def get_prompt_by_slug(self, slug: str):
            return self.prompts.get(slug)

        async def get_category_by_slug(self, slug: str):
            return self.categories.get(slug)

        async def get_tag_by_slug(self, slug: str):
            return self.tags.get(slug)

        def add_prompt(self, prompt) -> None:
            self.prompts[prompt.slug] = prompt

        def add_tag(self, tag: PromptTag) -> None:
            tag.id = self.next_tag_id
            self.next_tag_id += 1
            self.tags[tag.slug] = tag

        async def flush(self) -> None:
            return None

        async def commit(self) -> None:
            self.commits += 1

    repository = SeedRepository()
    service.repository = repository

    created = await service.ensure_builtin_prompts()
    created_again = await service.ensure_builtin_prompts()

    assert created == len(BUILTIN_PROMPT_SEEDS)
    assert created_again == 0
    assert len(repository.prompts) == len(BUILTIN_PROMPT_SEEDS)
    assert repository.commits == 1
