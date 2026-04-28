from types import SimpleNamespace

import pytest

from app.features.sessions.schemas import SessionCandidateCreate, SessionJudgeCreate
from app.features.sessions.service import (
    BenchmarkSessionNotFoundError,
    SessionService,
    SessionValidationError,
    serialize_prompt_item,
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
async def test_add_candidate_allows_more_than_previous_max() -> None:
    service = SessionService(SimpleNamespace())
    benchmark_session = SimpleNamespace(
        id=1,
        max_candidates=5,
        candidates=[
            SimpleNamespace(model_profile_id=1),
            SimpleNamespace(model_profile_id=2),
            SimpleNamespace(model_profile_id=3),
            SimpleNamespace(model_profile_id=4),
            SimpleNamespace(model_profile_id=5),
        ],
    )
    added = []

    class CandidateLimitRepository:
        async def get_session(self, session_id: int):
            return benchmark_session

        async def get_model_profile(self, model_profile_id: int):
            return SimpleNamespace(is_archived=False, role="candidate")

        def add_session_candidate(self, candidate) -> None:
            added.append(candidate)

        async def commit(self) -> None:
            return None

    service.repository = CandidateLimitRepository()  # type: ignore[assignment]

    async def fake_get_session(session_id: int):
        return SimpleNamespace(id=session_id)

    service.get_session = fake_get_session  # type: ignore[method-assign]

    result = await service.add_candidate(1, SessionCandidateCreate(model_profile_id=10))

    assert result.id == 1
    assert len(added) == 1
    assert added[0].display_order == 6


@pytest.mark.asyncio
async def test_add_judge_allows_more_than_one_judge() -> None:
    service = SessionService(SimpleNamespace())
    benchmark_session = SimpleNamespace(
        id=1,
        judges=[SimpleNamespace(id=1, model_profile_id=7)],
    )
    added = []

    class JudgeLimitRepository:
        async def get_session(self, session_id: int):
            return benchmark_session

        async def get_model_profile(self, model_profile_id: int):
            return SimpleNamespace(is_archived=False, role="judge")

        def add_session_judge(self, judge) -> None:
            added.append(judge)

        async def commit(self) -> None:
            return None

    service.repository = JudgeLimitRepository()  # type: ignore[assignment]

    async def fake_get_session(session_id: int):
        return SimpleNamespace(id=session_id)

    service.get_session = fake_get_session  # type: ignore[method-assign]

    result = await service.add_judge(1, SessionJudgeCreate(model_profile_id=10))

    assert result.id == 1
    assert len(added) == 1
    assert added[0].display_order == 2


def test_validate_candidate_role_rejects_non_candidate() -> None:
    service = SessionService(SimpleNamespace())
    model_profile = SimpleNamespace(is_archived=False, role="judge")

    with pytest.raises(SessionValidationError):
        service._validate_model_for_candidate(model_profile, 9)


def test_serialize_prompt_item_includes_scenario_picker_metadata() -> None:
    item = SimpleNamespace(id=1, prompt_id=9, display_order=2)
    prompt = SimpleNamespace(
        name="Scenario",
        category=SimpleNamespace(name="Code Debug"),
        cost_tier="low",
        estimated_input_tokens=320,
        scenario_type="code_debug",
    )

    result = serialize_prompt_item(item, prompt)

    assert result.prompt_name == "Scenario"
    assert result.category_name == "Code Debug"
    assert result.cost_tier == "low"
    assert result.estimated_input_tokens == 320
    assert result.scenario_type == "code_debug"
