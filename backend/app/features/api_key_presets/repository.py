from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.api_key_presets.models import ApiKeyPreset


class ApiKeyPresetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_api_key_presets(self) -> tuple[Sequence[ApiKeyPreset], int]:
        query = select(ApiKeyPreset).order_by(
            ApiKeyPreset.updated_at.desc(),
            ApiKeyPreset.id.desc(),
        )
        count_query = select(func.count(ApiKeyPreset.id))

        items_result = await self.session.execute(query)
        count_result = await self.session.execute(count_query)
        return items_result.scalars().all(), int(count_result.scalar_one())

    async def get_api_key_preset(self, preset_id: int) -> ApiKeyPreset | None:
        return await self.session.get(ApiKeyPreset, preset_id)

    def add(self, preset: ApiKeyPreset) -> None:
        self.session.add(preset)

    async def delete(self, preset: ApiKeyPreset) -> None:
        await self.session.delete(preset)

    async def commit(self) -> None:
        await self.session.commit()

    async def refresh(self, preset: ApiKeyPreset) -> None:
        await self.session.refresh(preset)

