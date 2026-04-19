from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.core.encryption import encrypt_value
from app.features.models_registry.schemas import (
    ModelProfileConnectionTestRequest,
    ModelProfileCreate,
)
from app.features.models_registry.service import (
    ModelProfileNotFoundError,
    ModelProfileService,
    ModelProfileValidationError,
    build_connection_test_request,
    interpret_connection_test_result,
    mask_secret_preview,
    serialize_model_profile,
    slugify,
)


def test_model_slugify_normalizes_values() -> None:
    assert slugify(" GPT-4o Mini ") == "gpt-4o-mini"
    assert slugify("###") == "model"


def test_serialize_model_profile_marks_secret_presence() -> None:
    from app.core.encryption import encrypt_value

    model = SimpleNamespace(
        id=1,
        display_name="Model A",
        slug="model-a",
        role="candidate",
        provider_type="openai",
        api_style="openai_compatible",
        runtime_type="remote",
        endpoint_url="https://example.com/v1/models",
        model_identifier="gpt-4o-mini",
        secret_encrypted=encrypt_value("super-secret"),
        api_key_preset_id=None,
        timeout_seconds=30,
        context_window=128000,
        pricing_input_per_million=Decimal("0.1500"),
        pricing_output_per_million=Decimal("0.6000"),
        notes=None,
        local_load_instructions=None,
        is_active=True,
        is_archived=False,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    serialized = serialize_model_profile(model)

    assert serialized.has_secret is True
    assert serialized.secret_preview == "su******et"
    assert serialized.api_key_preset_id is None
    assert "secret_masked" not in serialized.model_dump()


def test_mask_secret_preview_keeps_first_and_last_two_characters() -> None:
    assert mask_secret_preview("sk-1234567890ab") == "sk******ab"
    assert mask_secret_preview("abcd") == "****"
    assert mask_secret_preview("") is None


def test_build_connection_test_request_uses_post_for_openai_compatible() -> None:
    model = SimpleNamespace(
        provider_type="ovh",
        api_style="openai_compatible",
        endpoint_url="https://example.com/v1/chat/completions",
        model_identifier="gpt-5-mini",
    )

    method, url, payload = build_connection_test_request(model)

    assert method == "POST"
    assert url == "https://example.com/v1/chat/completions"
    assert payload == {
        "model": "gpt-5-mini",
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
    }


def test_build_connection_test_request_uses_post_for_huggingface() -> None:
    model = SimpleNamespace(
        provider_type="huggingface",
        api_style="huggingface",
        endpoint_url="https://api-inference.huggingface.co/models/x",
        model_identifier="unused",
    )

    method, url, payload = build_connection_test_request(model)

    assert method == "POST"
    assert url == "https://api-inference.huggingface.co/models/x"
    assert payload == {
        "inputs": "ping",
        "parameters": {"return_full_text": False, "max_new_tokens": 1},
    }


def test_build_connection_test_request_falls_back_to_get() -> None:
    model = SimpleNamespace(
        provider_type="custom",
        api_style="custom",
        endpoint_url="https://example.com/health",
        model_identifier="unused",
    )

    method, url, payload = build_connection_test_request(model)

    assert method == "GET"
    assert url == "https://example.com/health"
    assert payload is None


def test_build_connection_test_request_uses_model_lookup_for_openai() -> None:
    model = SimpleNamespace(
        provider_type="openai",
        api_style="openai_compatible",
        endpoint_url="https://api.openai.com/v1/chat/completions",
        model_identifier="gpt-5.4-mini",
    )

    method, url, payload = build_connection_test_request(model)

    assert method == "GET"
    assert url == "https://api.openai.com/v1/models/gpt-5.4-mini"
    assert payload is None


def test_interpret_connection_test_result_treats_429_as_reachable() -> None:
    result = interpret_connection_test_result(429, "POST")

    assert result.ok is True
    assert result.status_code == 429
    assert "rate-limited" in result.detail


@pytest.mark.asyncio
async def test_get_model_profile_raises_when_missing() -> None:
    service = ModelProfileService(SimpleNamespace())

    class MissingRepository:
        async def get_model_profile(self, model_id: int) -> None:
            return None

    service.repository = MissingRepository()  # type: ignore[assignment]

    with pytest.raises(ModelProfileNotFoundError):
        await service.get_model_profile(123)


@pytest.mark.asyncio
async def test_test_connection_raises_when_missing() -> None:
    service = ModelProfileService(SimpleNamespace())

    class MissingRepository:
        async def get_model_profile(self, model_id: int) -> None:
            return None

    service.repository = MissingRepository()  # type: ignore[assignment]

    with pytest.raises(ModelProfileNotFoundError):
        await service.test_connection(1, ModelProfileConnectionTestRequest())


def test_model_profile_create_schema_accepts_decimal_values() -> None:
    payload = ModelProfileCreate(
        display_name="OpenAI GPT-4o mini",
        role="both",
        provider_type="openai",
        api_style="openai_compatible",
        runtime_type="remote",
        endpoint_url="https://api.openai.com/v1/models",
        model_identifier="gpt-4o-mini",
        pricing_input_per_million=Decimal("0.1500"),
        pricing_output_per_million=Decimal("0.6000"),
    )

    assert payload.pricing_input_per_million == Decimal("0.1500")


@pytest.mark.asyncio
async def test_create_model_profile_forces_local_pricing_to_zero() -> None:
    service = ModelProfileService(SimpleNamespace())
    created = []

    class Repository:
        async def get_model_profile_by_slug(self, slug: str):
            return None

        def add(self, model_profile):
            model_profile.id = 1
            model_profile.created_at = datetime.now(UTC)
            model_profile.updated_at = datetime.now(UTC)
            created.append(model_profile)

        async def refresh(self, model_profile) -> None:
            return None

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    payload = ModelProfileCreate(
        display_name="Local Model",
        role="candidate",
        provider_type="lmstudio",
        api_style="openai_compatible",
        runtime_type="local",
        endpoint_url="http://127.0.0.1:1234/v1/chat/completions",
        model_identifier="local-model",
        pricing_input_per_million=Decimal("1.0000"),
        pricing_output_per_million=Decimal("2.0000"),
    )

    result = await service.create_model_profile(payload)

    assert created[0].pricing_input_per_million == Decimal("0")
    assert created[0].pricing_output_per_million == Decimal("0")
    assert result.pricing_input_per_million == Decimal("0")
    assert result.pricing_output_per_million == Decimal("0")


@pytest.mark.asyncio
async def test_create_model_profile_can_copy_secret_from_api_key_preset() -> None:
    service = ModelProfileService(SimpleNamespace())
    created = []

    class ModelRepository:
        async def get_model_profile_by_slug(self, slug: str):
            return None

        def add(self, model_profile):
            model_profile.id = 1
            model_profile.created_at = datetime.now(UTC)
            model_profile.updated_at = datetime.now(UTC)
            created.append(model_profile)

        async def refresh(self, model_profile) -> None:
            return None

        async def commit(self) -> None:
            return None

    class ApiKeyPresetRepository:
        async def get_api_key_preset(self, preset_id: int):
            return SimpleNamespace(secret_encrypted=encrypt_value("preset-secret"))

    service.repository = ModelRepository()  # type: ignore[assignment]
    service.api_key_preset_repository = ApiKeyPresetRepository()  # type: ignore[assignment]

    result = await service.create_model_profile(
        ModelProfileCreate(
            display_name="OpenAI GPT-5",
            role="candidate",
            provider_type="openai",
            api_style="openai_compatible",
            runtime_type="remote",
            endpoint_url="https://api.openai.com/v1/chat/completions",
            model_identifier="gpt-5",
            api_key_preset_id=12,
        )
    )

    assert created[0].secret_encrypted is not None
    assert created[0].api_key_preset_id == 12
    assert result.has_secret is True
    assert result.api_key_preset_id == 12


@pytest.mark.asyncio
async def test_create_model_profile_raises_when_api_key_preset_is_missing() -> None:
    service = ModelProfileService(SimpleNamespace())

    class ModelRepository:
        async def get_model_profile_by_slug(self, slug: str):
            return None

    class ApiKeyPresetRepository:
        async def get_api_key_preset(self, preset_id: int):
            return None

    service.repository = ModelRepository()  # type: ignore[assignment]
    service.api_key_preset_repository = ApiKeyPresetRepository()  # type: ignore[assignment]

    with pytest.raises(ModelProfileValidationError):
        await service.create_model_profile(
            ModelProfileCreate(
                display_name="OpenAI GPT-5",
                role="candidate",
                provider_type="openai",
                api_style="openai_compatible",
                runtime_type="remote",
                endpoint_url="https://api.openai.com/v1/chat/completions",
                model_identifier="gpt-5",
                api_key_preset_id=999,
            )
        )
