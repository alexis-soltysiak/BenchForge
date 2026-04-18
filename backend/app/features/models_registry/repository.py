from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.models_registry.models import ModelProfile


class ModelProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_model_profiles(
        self,
        include_archived: bool,
    ) -> tuple[Sequence[ModelProfile], int]:
        query = select(ModelProfile).order_by(
            ModelProfile.updated_at.desc(),
            ModelProfile.id.desc(),
        )
        count_query = select(func.count(ModelProfile.id))
        if not include_archived:
            query = query.where(ModelProfile.is_archived.is_(False))
            count_query = count_query.where(ModelProfile.is_archived.is_(False))

        items_result = await self.session.execute(query)
        count_result = await self.session.execute(count_query)
        return items_result.scalars().all(), int(count_result.scalar_one())

    async def get_model_profile(self, model_id: int) -> ModelProfile | None:
        return await self.session.get(ModelProfile, model_id)

    async def get_model_profile_by_slug(self, slug: str) -> ModelProfile | None:
        result = await self.session.execute(
            select(ModelProfile).where(ModelProfile.slug == slug)
        )
        return result.scalar_one_or_none()

    async def get_distinct_machine_labels(self) -> list[str]:
        result = await self.session.execute(
            select(ModelProfile.machine_label)
            .where(ModelProfile.machine_label.isnot(None))
            .where(ModelProfile.machine_label != "")
            .distinct()
            .order_by(ModelProfile.machine_label)
        )
        return [label for label in result.scalars().all() if label]

    def add(self, model_profile: ModelProfile) -> None:
        self.session.add(model_profile)

    async def commit(self) -> None:
        await self.session.commit()
