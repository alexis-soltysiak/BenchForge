from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.judging.models import JudgeBatch, JudgeEvaluation
from app.features.runs.models import CandidateResponse, SessionRun


class ReportsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_run(self, run_id: int) -> SessionRun | None:
        result = await self.session.execute(
            select(SessionRun)
            .where(SessionRun.id == run_id)
            .options(
                selectinload(SessionRun.prompt_snapshots),
                selectinload(SessionRun.model_snapshots),
                selectinload(SessionRun.candidate_responses).selectinload(
                    CandidateResponse.metric
                ),
                selectinload(SessionRun.global_summaries),
                selectinload(SessionRun.judge_batches)
                .selectinload(JudgeBatch.evaluation)
                .selectinload(JudgeEvaluation.candidates),
            )
        )
        return result.scalar_one_or_none()

    async def commit(self) -> None:
        await self.session.commit()
