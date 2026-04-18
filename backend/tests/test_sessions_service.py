from types import SimpleNamespace

import pytest

from app.features.sessions.schemas import SessionCandidateCreate, SessionJudgeCreate
from app.features.sessions.service import (
    BenchmarkSessionNotFoundError,
    SessionService,
    SessionValidationError,
)


@pytest.mark.asyncio
async def test_get_session_raises_when_missing() -> None:
    service = SessionService(SimpleNamespace())

    class MissingRepository:
        async def get_session(self, session_id: int) -> None:
            return None

    service.repository = MissingRepository()  # type: ignore[assignment]

    with pytest.raises(BenchmarkSessionNotFoundError):
        await service.get_session(1)


@pytest.mark.asyncio
async def test_add_candidate_enforces_max_five() -> None:
    service = SessionService(SimpleNamespace())
    benchmark_session = SimpleNamespace(
        id=1,
        max_candidates=5,
        candidates=[1, 2, 3, 4, 5],
    )

    class CandidateLimitRepository:
        async def get_session(self, session_id: int):
            return benchmark_session

    service.repository = CandidateLimitRepository()  # type: ignore[assignment]

    with pytest.raises(SessionValidationError):
        await service.add_candidate(1, SessionCandidateCreate(model_profile_id=10))


@pytest.mark.asyncio
async def test_add_judge_enforces_single_judge() -> None:
    service = SessionService(SimpleNamespace())
    benchmark_session = SimpleNamespace(
        id=1,
        judges=[SimpleNamespace(id=1)],
    )

    class JudgeLimitRepository:
        async def get_session(self, session_id: int):
            return benchmark_session

    service.repository = JudgeLimitRepository()  # type: ignore[assignment]

    with pytest.raises(SessionValidationError):
        await service.add_judge(1, SessionJudgeCreate(model_profile_id=10))


def test_validate_candidate_role_rejects_non_candidate() -> None:
    service = SessionService(SimpleNamespace())
    model_profile = SimpleNamespace(is_archived=False, role="judge")

    with pytest.raises(SessionValidationError):
        service._validate_model_for_candidate(model_profile, 9)

