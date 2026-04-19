from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_value, encrypt_value
from app.features.api_key_presets.models import ApiKeyPreset
from app.features.api_key_presets.repository import ApiKeyPresetRepository
from app.features.api_key_presets.schemas import (
    ApiKeyPresetCreate,
    ApiKeyPresetListResponse,
    ApiKeyPresetRead,
    ApiKeyPresetUpdate,
)


class ApiKeyPresetNotFoundError(ValueError):
    pass


def mask_secret_preview(secret: str | None) -> str | None:
    if not secret:
        return None
    if len(secret) <= 4:
        return "*" * len(secret)
    return f"{secret[:2]}******{secret[-2:]}"


def serialize_api_key_preset(preset: ApiKeyPreset) -> ApiKeyPresetRead:
    decrypted_secret = decrypt_value(preset.secret_encrypted) if preset.secret_encrypted else None
    return ApiKeyPresetRead(
        id=preset.id,
        name=preset.name,
        provider_type=preset.provider_type,
        has_secret=bool(preset.secret_encrypted),
        secret_preview=mask_secret_preview(decrypted_secret),
        created_at=preset.created_at,
        updated_at=preset.updated_at,
    )


@dataclass
class ApiKeyPresetService:
    session: AsyncSession
    repository: ApiKeyPresetRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = ApiKeyPresetRepository(self.session)

    async def list_api_key_presets(self) -> ApiKeyPresetListResponse:
        items, total = await self.repository.list_api_key_presets()
        return ApiKeyPresetListResponse(
            items=[serialize_api_key_preset(item) for item in items],
            total=total,
        )

    async def create_api_key_preset(
        self,
        payload: ApiKeyPresetCreate,
    ) -> ApiKeyPresetRead:
        preset = ApiKeyPreset(
            name=payload.name.strip(),
            provider_type=payload.provider_type.strip(),
            secret_encrypted=encrypt_value(payload.secret.strip()),
        )
        self.repository.add(preset)
        await self.repository.commit()
        await self.repository.refresh(preset)
        return serialize_api_key_preset(preset)

    async def update_api_key_preset(
        self,
        preset_id: int,
        payload: ApiKeyPresetUpdate,
    ) -> ApiKeyPresetRead:
        preset = await self.repository.get_api_key_preset(preset_id)
        if preset is None:
            raise ApiKeyPresetNotFoundError(f"API key preset {preset_id} not found.")

        updates = payload.model_dump(exclude_unset=True)
        if "name" in updates and updates["name"] is not None:
            preset.name = updates["name"].strip()
        if "provider_type" in updates and updates["provider_type"] is not None:
            preset.provider_type = updates["provider_type"].strip()
        if "secret" in updates and updates["secret"]:
            preset.secret_encrypted = encrypt_value(updates["secret"].strip())

        await self.repository.commit()
        await self.repository.refresh(preset)
        return serialize_api_key_preset(preset)

    async def delete_api_key_preset(self, preset_id: int) -> None:
        preset = await self.repository.get_api_key_preset(preset_id)
        if preset is None:
            raise ApiKeyPresetNotFoundError(f"API key preset {preset_id} not found.")

        await self.repository.delete(preset)
        await self.repository.commit()
