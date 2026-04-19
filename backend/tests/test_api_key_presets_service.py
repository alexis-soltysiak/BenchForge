from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.core.encryption import decrypt_value, encrypt_value
from app.features.api_key_presets.schemas import ApiKeyPresetCreate, ApiKeyPresetUpdate
from app.features.api_key_presets.service import (
    ApiKeyPresetNotFoundError,
    ApiKeyPresetService,
    mask_secret_preview,
    serialize_api_key_preset,
)


def test_serialize_api_key_preset_marks_secret_presence() -> None:
    preset = SimpleNamespace(
        id=1,
        name="OpenAI prod",
        provider_type="openai",
        secret_encrypted=encrypt_value("encrypted"),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    serialized = serialize_api_key_preset(preset)

    assert serialized.has_secret is True
    assert serialized.secret_preview == "en******ed"


def test_mask_secret_preview_keeps_first_and_last_two_characters() -> None:
    assert mask_secret_preview("sk-1234567890ab") == "sk******ab"
    assert mask_secret_preview("abcd") == "****"
    assert mask_secret_preview("") is None


@pytest.mark.asyncio
async def test_update_api_key_preset_raises_when_missing() -> None:
    service = ApiKeyPresetService(SimpleNamespace())

    class MissingRepository:
        async def get_api_key_preset(self, preset_id: int) -> None:
            return None

    service.repository = MissingRepository()  # type: ignore[assignment]

    with pytest.raises(ApiKeyPresetNotFoundError):
        await service.update_api_key_preset(1, ApiKeyPresetUpdate(name="Updated"))


@pytest.mark.asyncio
async def test_create_api_key_preset_encrypts_secret() -> None:
    service = ApiKeyPresetService(SimpleNamespace())
    created = []

    class Repository:
        def add(self, preset) -> None:
            preset.id = 1
            preset.created_at = datetime.now(UTC)
            preset.updated_at = datetime.now(UTC)
            created.append(preset)

        async def commit(self) -> None:
            return None

        async def refresh(self, preset) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    result = await service.create_api_key_preset(
        ApiKeyPresetCreate(
            name="OpenAI prod",
            provider_type="openai",
            secret="sk-secret",
        )
    )

    assert result.has_secret is True
    assert decrypt_value(created[0].secret_encrypted) == "sk-secret"
