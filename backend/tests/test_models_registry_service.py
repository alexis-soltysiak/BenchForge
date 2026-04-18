from datetime import datetime, UTC
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.features.models_registry.schemas import (
    ModelProfileConnectionTestRequest,
    ModelProfileCreate,
)
from app.features.models_registry.service import (
    ModelProfileNotFoundError,
    ModelProfileService,
    serialize_model_profile,
    slugify,
)


def test_model_slugify_normalizes_values() -> None:
    assert slugify(" GPT-4o Mini ") == "gpt-4o-mini"
    assert slugify("###") == "model"


def test_serialize_model_profile_masks_secret() -> None:
    from app.core.encryption import encrypt_value

    model = SimpleNamespace(
        id=1,
        display_name="Model A",
        slug="model-a",
        role="candidate",
        provider_type="openai",
        api_style="openai_compatible",
        runtime_type="remote",
        machine_label=None,
        endpoint_url="https://example.com/v1/models",
        model_identifier="gpt-4o-mini",
        secret_encrypted=encrypt_value("super-secret"),
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

    assert serialized.secret_masked == "********cret"


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
