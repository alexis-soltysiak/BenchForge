from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.judging.models import JudgeBatch, JudgeEvaluation
from app.features.runs.models import CandidateResponse, SessionRun


class JudgingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_run(self, run_id: int) -> SessionRun | None:
        result = await self.session.execute(
            select(SessionRun)
            .where(SessionRun.id == run_id)
            .options(
                selectinload(SessionRun.prompt_snapshots),
                selectinload(SessionRun.model_snapshots),
                selectinload(SessionRun.candidate_responses).selectinload(CandidateResponse.metric),
            )
        )
        return result.scalar_one_or_none()

    async def list_batches(self, run_id: int) -> Sequence[JudgeBatch]:
        result = await self.session.execute(
            select(JudgeBatch)
            .where(JudgeBatch.run_id == run_id)
            .options(
                selectinload(JudgeBatch.evaluation).selectinload(JudgeEvaluation.candidates),
            )
            .order_by(JudgeBatch.prompt_snapshot_id.asc(), JudgeBatch.batch_index.asc())
        )
        return result.scalars().all()

    async def get_batch(self, batch_id: int) -> JudgeBatch | None:
        result = await self.session.execute(
            select(JudgeBatch)
            .where(JudgeBatch.id == batch_id)
            .options(
                selectinload(JudgeBatch.evaluation).selectinload(JudgeEvaluation.candidates),
            )
        )
        return result.scalar_one_or_none()

    def add_batch(self, batch: JudgeBatch) -> None:
        self.session.add(batch)

    async def commit(self) -> None:
        await self.session.commit()
