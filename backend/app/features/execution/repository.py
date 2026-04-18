from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.runs.models import CandidateResponse, SessionRun


class ExecutionRepository:
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

    def add_candidate_response(self, candidate_response: CandidateResponse) -> None:
        self.session.add(candidate_response)

    async def list_candidate_responses(self, run_id: int) -> Sequence[CandidateResponse]:
        result = await self.session.execute(
            select(CandidateResponse)
            .where(CandidateResponse.run_id == run_id)
            .options(selectinload(CandidateResponse.metric))
            .order_by(CandidateResponse.id.asc())
        )
        return result.scalars().all()

    async def get_candidate_response(self, response_id: int) -> CandidateResponse | None:
        result = await self.session.execute(
            select(CandidateResponse)
            .where(CandidateResponse.id == response_id)
            .options(selectinload(CandidateResponse.metric))
        )
        return result.scalar_one_or_none()

    async def commit(self) -> None:
        await self.session.commit()
