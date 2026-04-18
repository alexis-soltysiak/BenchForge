from types import SimpleNamespace

import pytest

from app.features.execution.service import ExecutionService, LocalExecutionNotReadyError
from app.features.runs.models import CandidateResponse


@pytest.mark.asyncio
async def test_resume_run_requires_existing_run() -> None:
    service = ExecutionService(SimpleNamespace())

    class Repository:
        async def get_run(self, run_id: int):
            return None

    service.repository = Repository()  # type: ignore[assignment]

    with pytest.raises(ValueError):
        await service.resume_run(1)


@pytest.mark.asyncio
async def test_ensure_candidate_response_rows_creates_matrix() -> None:
    service = ExecutionService(SimpleNamespace())
    created: list[CandidateResponse] = []

    class Repository:
        def add_candidate_response(self, candidate_response: CandidateResponse) -> None:
            created.append(candidate_response)

    service.repository = Repository()  # type: ignore[assignment]

    run = SimpleNamespace(
        id=1,
        prompt_snapshots=[SimpleNamespace(id=10), SimpleNamespace(id=11)],
        model_snapshots=[
            SimpleNamespace(id=20, role="candidate"),
            SimpleNamespace(id=21, role="judge"),
        ],
        candidate_responses=[],
    )

    await service._ensure_candidate_response_rows(run)

    assert len(created) == 2
    assert {(item.prompt_snapshot_id, item.model_snapshot_id) for item in created} == {
        (10, 20),
        (11, 20),
    }


@pytest.mark.asyncio
async def test_get_local_next_raises_when_no_local_model_left() -> None:
    service = ExecutionService(SimpleNamespace())

    class Repository:
        async def get_run(self, run_id: int):
            return SimpleNamespace(
                id=run_id,
                prompt_snapshots=[],
                model_snapshots=[],
                candidate_responses=[],
                notes=None,
            )

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    with pytest.raises(LocalExecutionNotReadyError):
        await service.get_local_next(1)
