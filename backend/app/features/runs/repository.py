from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.judging.models import JudgeBatch, JudgeEvaluation
from app.features.models_registry.models import ModelProfile
from app.features.prompts.models import Prompt
from app.features.runs.models import CandidateResponse, SessionRun
from app.features.sessions.models import BenchmarkSession


class RunRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_session_with_relations(
        self,
        session_id: int,
    ) -> BenchmarkSession | None:
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
        result = await self.session.execute(
            select(Prompt)
            .where(Prompt.id == prompt_id)
            .options(selectinload(Prompt.category))
        )
        return result.scalar_one_or_none()

    async def get_model_profile(self, model_profile_id: int) -> ModelProfile | None:
        return await self.session.get(ModelProfile, model_profile_id)

    def add_run(self, run: SessionRun) -> None:
        self.session.add(run)

    async def list_runs(self) -> tuple[Sequence[SessionRun], int]:
        result = await self.session.execute(
            select(SessionRun)
            .options(
                selectinload(SessionRun.prompt_snapshots),
                selectinload(SessionRun.model_snapshots),
                selectinload(SessionRun.candidate_responses).selectinload(CandidateResponse.metric),
                selectinload(SessionRun.global_summaries),
                selectinload(SessionRun.judge_batches)
                .selectinload(JudgeBatch.evaluation)
                .selectinload(JudgeEvaluation.candidates),
            )
            .order_by(SessionRun.launched_at.desc(), SessionRun.id.desc())
        )
        count_result = await self.session.execute(select(func.count(SessionRun.id)))
        return result.scalars().all(), int(count_result.scalar_one())

    async def get_run(self, run_id: int) -> SessionRun | None:
        result = await self.session.execute(
            select(SessionRun)
            .where(SessionRun.id == run_id)
            .options(
                selectinload(SessionRun.prompt_snapshots),
                selectinload(SessionRun.model_snapshots),
                selectinload(SessionRun.candidate_responses).selectinload(CandidateResponse.metric),
                selectinload(SessionRun.global_summaries),
                selectinload(SessionRun.judge_batches)
                .selectinload(JudgeBatch.evaluation)
                .selectinload(JudgeEvaluation.candidates),
            )
        )
        return result.scalar_one_or_none()

    async def get_prompt_difficulties(self, source_prompt_ids: list[int]) -> dict[int, int | None]:
        if not source_prompt_ids:
            return {}
        result = await self.session.execute(
            select(Prompt.id, Prompt.difficulty).where(Prompt.id.in_(source_prompt_ids))
        )
        return {row.id: row.difficulty for row in result}

    async def delete_run(self, run: SessionRun) -> None:
        await self.session.delete(run)

    async def commit(self) -> None:
        await self.session.commit()
