from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.features.prompts.builtin_seed import BUILTIN_PROMPT_SEEDS
from app.features.prompts.models import PromptCategory, PromptTag
from app.features.prompts.rendering import render_scenario_prompt
from app.features.prompts.schemas import PromptCreate
from app.features.prompts.service import (
    PromptCategoryNotFoundError,
    PromptNotFoundError,
    PromptService,
    slugify,
)


def test_slugify_normalizes_values() -> None:
    assert slugify("  General QA Prompt  ") == "general-qa-prompt"
    assert slugify("###") == "item"


def test_render_scenario_prompt_composes_structured_fields() -> None:
    prompt = SimpleNamespace(
        user_prompt_text="Diagnose and patch.",
        objective="Fix the API bug.",
        context="Offers are created without skills.",
        input_artifacts_jsonb=[
            {
                "name": "router.py",
                "kind": "code",
                "language": "python",
                "content": "def create_offer(): pass",
            }
        ],
        constraints_jsonb=["No new dependency."],
        expected_output_format="Bullets only.",
    )

    rendered = render_scenario_prompt(prompt)

    assert "## Objective\nFix the API bug." in rendered
    assert "### router.py (code, python)" in rendered
    assert "- No new dependency." in rendered
    assert "## Task\nDiagnose and patch." in rendered


def test_render_scenario_prompt_keeps_simple_prompt_compatible() -> None:
    prompt = SimpleNamespace(
        user_prompt_text="Explain caching.",
        objective=None,
        context=None,
        input_artifacts_jsonb=None,
        constraints_jsonb=None,
        expected_output_format=None,
    )

    assert render_scenario_prompt(prompt) == "Explain caching."


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
async def test_create_structured_scenario() -> None:
    service = PromptService(SimpleNamespace())
    category = PromptCategory(
        id=1,
        name="Code Debug",
        slug="code_debug",
        description=None,
        is_system=True,
    )
    category.created_at = datetime.now(UTC)

    class Repository:
        def __init__(self) -> None:
            self.prompt = None

        async def get_category(self, category_id: int):
            return category

        async def get_prompt_by_slug(self, slug: str):
            return None

        async def get_tag_by_slug(self, slug: str):
            return None

        def add_tag(self, tag: PromptTag) -> None:
            tag.id = 1

        async def flush(self) -> None:
            return None

        def add_prompt(self, prompt) -> None:
            prompt.id = 10
            prompt.category = category
            prompt.tag_links = []
            prompt.created_at = datetime.now(UTC)
            prompt.updated_at = datetime.now(UTC)
            self.prompt = prompt

        async def commit(self) -> None:
            return None

        async def get_prompt(self, prompt_id: int):
            return self.prompt

    service.repository = Repository()

    created = await service.create_prompt(
        PromptCreate(
            name="Structured scenario",
            category_id=1,
            user_prompt_text="Fix it.",
            scenario_type="code_debug",
            objective="Find the bug.",
            input_artifacts_jsonb=[
                {"name": "router.py", "kind": "code", "content": "pass"}
            ],
            gold_facts_jsonb={"must_include": ["bug"], "must_not_include": []},
            judge_rubric_jsonb={"criteria": [{"key": "correctness"}]},
            cost_tier="low",
            weight=2,
        )
    )

    assert created.scenario_type == "code_debug"
    assert created.objective == "Find the bug."
    assert created.input_artifacts_jsonb
    assert created.gold_facts_jsonb == {"must_include": ["bug"], "must_not_include": []}
    assert created.weight == 2


@pytest.mark.asyncio
async def test_ensure_builtin_prompts_is_idempotent() -> None:
    service = PromptService(SimpleNamespace())

    class SeedRepository:
        def __init__(self) -> None:
            self.categories = {
                slug: SimpleNamespace(id=index)
                for index, slug in enumerate(
                    sorted({seed.category_slug for seed in BUILTIN_PROMPT_SEEDS}),
                    start=1,
                )
            }
            self.prompts: dict[str, SimpleNamespace] = {}
            self.tags: dict[str, PromptTag] = {}
            self.next_tag_id = 1
            self.commits = 0

        async def list_prompts(self, include_archived: bool):
            return list(self.prompts.values()), len(self.prompts)

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
    assert repository.commits == 2
    assert "fastapi-offer-skills-debug" in repository.prompts
    assert all(prompt.judge_rubric_jsonb for prompt in repository.prompts.values())
