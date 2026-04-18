from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.models_registry.models import ModelProfile
from app.features.prompts.models import Prompt
from app.features.sessions.models import (
    BenchmarkSession,
    BenchmarkSessionCandidate,
    BenchmarkSessionJudge,
    BenchmarkSessionPrompt,
)


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_sessions(self, include_archived: bool) -> tuple[Sequence[BenchmarkSession], int]:
        query = (
            select(BenchmarkSession)
            .options(
                selectinload(BenchmarkSession.prompts),
                selectinload(BenchmarkSession.candidates),
                selectinload(BenchmarkSession.judges),
            )
            .order_by(BenchmarkSession.updated_at.desc(), BenchmarkSession.id.desc())
        )
        count_query = select(func.count(BenchmarkSession.id))
        if not include_archived:
            query = query.where(BenchmarkSession.status != "archived")
            count_query = count_query.where(BenchmarkSession.status != "archived")

        items_result = await self.session.execute(query)
        count_result = await self.session.execute(count_query)
        return items_result.scalars().all(), int(count_result.scalar_one())

    async def get_session(self, session_id: int) -> BenchmarkSession | None:
        result = await self.session.execute(
            select(BenchmarkSession)
            .where(BenchmarkSession.id == session_id)
            .options(
                selectinload(BenchmarkSession.prompts),
                selectinload(BenchmarkSession.candidates),
                selectinload(BenchmarkSession.judges),
            )
        )
        return result.scalar_one_or_none()

    async def get_prompt(self, prompt_id: int) -> Prompt | None:
        return await self.session.get(Prompt, prompt_id)

    async def get_model_profile(self, model_profile_id: int) -> ModelProfile | None:
        return await self.session.get(ModelProfile, model_profile_id)

    def add_session(self, benchmark_session: BenchmarkSession) -> None:
        self.session.add(benchmark_session)

    def add_session_prompt(self, item: BenchmarkSessionPrompt) -> None:
        self.session.add(item)

    def add_session_candidate(self, item: BenchmarkSessionCandidate) -> None:
        self.session.add(item)

    def add_session_judge(self, item: BenchmarkSessionJudge) -> None:
        self.session.add(item)

    async def delete(self, instance: object) -> None:
        await self.session.delete(instance)

    async def commit(self) -> None:
        await self.session.commit()

