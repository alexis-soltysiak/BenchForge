from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
import re

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_value, encrypt_value
from app.core.security import build_bearer_token
from app.features.models_registry.builtin_seed import BUILTIN_MODEL_PROFILE_SEEDS
from app.features.models_registry.models import ModelProfile
from app.features.models_registry.repository import ModelProfileRepository
from app.features.models_registry.schemas import (
    ModelProfileConnectionTestRequest,
    ModelProfileConnectionTestResponse,
    ModelProfileCreate,
    ModelProfileRead,
    ModelProfileUpdate,
)

SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


class ModelProfileNotFoundError(ValueError):
    pass


def slugify(value: str) -> str:
    slug = SLUG_PATTERN.sub("-", value.strip().lower()).strip("-")
    return slug or "model"


async def build_unique_model_slug(
    repository: ModelProfileRepository,
    base_value: str,
    current_model_id: int | None = None,
) -> str:
    base_slug = slugify(base_value)
    slug = base_slug
    suffix = 2

    while True:
        existing = await repository.get_model_profile_by_slug(slug)
        if existing is None or existing.id == current_model_id:
            return slug
        slug = f"{base_slug}-{suffix}"
        suffix += 1


def serialize_model_profile(model_profile: ModelProfile) -> ModelProfileRead:
    return ModelProfileRead(
        id=model_profile.id,
        display_name=model_profile.display_name,
        slug=model_profile.slug,
        role=model_profile.role,
        provider_type=model_profile.provider_type,
        api_style=model_profile.api_style,
        runtime_type=model_profile.runtime_type,
        endpoint_url=model_profile.endpoint_url,
        model_identifier=model_profile.model_identifier,
        has_secret=model_profile.secret_encrypted is not None,
        timeout_seconds=model_profile.timeout_seconds,
        context_window=model_profile.context_window,
        pricing_input_per_million=(
            Decimal(model_profile.pricing_input_per_million)
            if model_profile.pricing_input_per_million is not None
            else None
        ),
        pricing_output_per_million=(
            Decimal(model_profile.pricing_output_per_million)
            if model_profile.pricing_output_per_million is not None
            else None
        ),
        notes=model_profile.notes,
        local_load_instructions=model_profile.local_load_instructions,
        is_active=model_profile.is_active,
        is_archived=model_profile.is_archived,
        created_at=model_profile.created_at,
        updated_at=model_profile.updated_at,
    )


@dataclass
class ModelProfileService:
    session: AsyncSession
    repository: ModelProfileRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = ModelProfileRepository(self.session)

    async def list_model_profiles(
        self,
        include_archived: bool,
    ) -> tuple[list[ModelProfileRead], int]:
        await self.ensure_builtin_model_profiles()
        items, total = await self.repository.list_model_profiles(include_archived)
        return [serialize_model_profile(item) for item in items], total

    async def get_distinct_machine_labels(self) -> list[str]:
        return await self.repository.get_distinct_machine_labels()

    async def get_model_profile(self, model_id: int) -> ModelProfileRead:
        model_profile = await self.repository.get_model_profile(model_id)
        if model_profile is None:
            raise ModelProfileNotFoundError(f"Model profile {model_id} not found.")
        return serialize_model_profile(model_profile)

    async def create_model_profile(
        self,
        payload: ModelProfileCreate,
    ) -> ModelProfileRead:
        model_profile = ModelProfile(
            display_name=payload.display_name.strip(),
            slug=await build_unique_model_slug(self.repository, payload.display_name),
            role=payload.role,
            provider_type=payload.provider_type.strip(),
            api_style=payload.api_style.strip(),
            runtime_type=payload.runtime_type,
            endpoint_url=payload.endpoint_url.strip(),
            model_identifier=payload.model_identifier.strip(),
            secret_encrypted=encrypt_value(payload.secret) if payload.secret else None,
            timeout_seconds=payload.timeout_seconds,
            context_window=payload.context_window,
            pricing_input_per_million=payload.pricing_input_per_million,
            pricing_output_per_million=payload.pricing_output_per_million,
            notes=payload.notes,
            local_load_instructions=payload.local_load_instructions,
            is_active=payload.is_active,
            is_archived=False,
        )
        if model_profile.runtime_type == "local":
            model_profile.pricing_input_per_million = Decimal("0")
            model_profile.pricing_output_per_million = Decimal("0")
        self.repository.add(model_profile)
        await self.repository.commit()
        await self.repository.refresh(model_profile)
        return serialize_model_profile(model_profile)

    async def update_model_profile(
        self,
        model_id: int,
        payload: ModelProfileUpdate,
    ) -> ModelProfileRead:
        model_profile = await self.repository.get_model_profile(model_id)
        if model_profile is None:
            raise ModelProfileNotFoundError(f"Model profile {model_id} not found.")

        updates = payload.model_dump(exclude_unset=True)

        if "display_name" in updates and updates["display_name"] is not None:
            model_profile.display_name = updates["display_name"].strip()
            model_profile.slug = await build_unique_model_slug(
                self.repository,
                model_profile.display_name,
                current_model_id=model_profile.id,
            )
        if "role" in updates and updates["role"] is not None:
            model_profile.role = updates["role"]
        if "provider_type" in updates and updates["provider_type"] is not None:
            model_profile.provider_type = updates["provider_type"].strip()
        if "api_style" in updates and updates["api_style"] is not None:
            model_profile.api_style = updates["api_style"].strip()
        if "runtime_type" in updates and updates["runtime_type"] is not None:
            model_profile.runtime_type = updates["runtime_type"]
        if "endpoint_url" in updates and updates["endpoint_url"] is not None:
            model_profile.endpoint_url = updates["endpoint_url"].strip()
        if "model_identifier" in updates and updates["model_identifier"] is not None:
            model_profile.model_identifier = updates["model_identifier"].strip()
        if "secret" in updates:
            model_profile.secret_encrypted = (
                encrypt_value(updates["secret"]) if updates["secret"] else None
            )
        if "timeout_seconds" in updates and updates["timeout_seconds"] is not None:
            model_profile.timeout_seconds = updates["timeout_seconds"]
        if "context_window" in updates:
            model_profile.context_window = updates["context_window"]
        if "pricing_input_per_million" in updates:
            model_profile.pricing_input_per_million = updates[
                "pricing_input_per_million"
            ]
        if "pricing_output_per_million" in updates:
            model_profile.pricing_output_per_million = updates[
                "pricing_output_per_million"
            ]
        if "notes" in updates:
            model_profile.notes = updates["notes"]
        if "local_load_instructions" in updates:
            model_profile.local_load_instructions = updates["local_load_instructions"]
        if "is_active" in updates and updates["is_active"] is not None:
            model_profile.is_active = updates["is_active"]

        if model_profile.runtime_type == "local":
            model_profile.pricing_input_per_million = Decimal("0")
            model_profile.pricing_output_per_million = Decimal("0")

        await self.repository.commit()
        await self.repository.refresh(model_profile)
        return serialize_model_profile(model_profile)

    async def ensure_builtin_model_profiles(self) -> int:
        created_count = 0

        for seed in BUILTIN_MODEL_PROFILE_SEEDS:
            existing = await self.repository.get_model_profile_by_slug(
                slugify(seed.display_name)
            )
            if existing is not None:
                continue

            model_profile = ModelProfile(
                display_name=seed.display_name,
                slug=slugify(seed.display_name),
                role=seed.role,
                provider_type=seed.provider_type,
                api_style=seed.api_style,
                runtime_type=seed.runtime_type,
                endpoint_url=seed.endpoint_url,
                model_identifier=seed.model_identifier,
                secret_encrypted=encrypt_value(seed.secret) if seed.secret else None,
                timeout_seconds=seed.timeout_seconds,
                context_window=None,
                pricing_input_per_million=seed.pricing_input_per_million,
                pricing_output_per_million=seed.pricing_output_per_million,
                notes=seed.notes,
                local_load_instructions=seed.local_load_instructions,
                is_active=seed.is_active,
                is_archived=False,
            )
            self.repository.add(model_profile)
            created_count += 1

        if created_count:
            await self.repository.commit()

        return created_count

    async def archive_model_profile(self, model_id: int) -> ModelProfileRead:
        model_profile = await self.repository.get_model_profile(model_id)
        if model_profile is None:
            raise ModelProfileNotFoundError(f"Model profile {model_id} not found.")

        model_profile.is_active = False
        model_profile.is_archived = True
        await self.repository.commit()
        await self.repository.refresh(model_profile)
        return serialize_model_profile(model_profile)

    async def test_connection(
        self,
        model_id: int,
        payload: ModelProfileConnectionTestRequest,
    ) -> ModelProfileConnectionTestResponse:
        model_profile = await self.repository.get_model_profile(model_id)
        if model_profile is None:
            raise ModelProfileNotFoundError(f"Model profile {model_id} not found.")

        timeout_seconds = payload.timeout_seconds or model_profile.timeout_seconds
        headers: dict[str, str] = {}
        if model_profile.secret_encrypted:
            headers["Authorization"] = build_bearer_token(
                decrypt_value(model_profile.secret_encrypted)
            )

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.get(model_profile.endpoint_url, headers=headers)
            return ModelProfileConnectionTestResponse(
                ok=response.status_code < 400,
                status_code=response.status_code,
                detail=f"Received HTTP {response.status_code} from endpoint.",
            )
        except httpx.HTTPError as exc:
            return ModelProfileConnectionTestResponse(
                ok=False,
                status_code=None,
                detail=str(exc),
            )
