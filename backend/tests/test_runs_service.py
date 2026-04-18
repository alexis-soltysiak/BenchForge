from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.features.runs.service import RunLaunchValidationError, RunService


@pytest.mark.asyncio
async def test_launch_run_requires_prompts() -> None:
    service = RunService(SimpleNamespace())
    benchmark_session = SimpleNamespace(
        prompts=[],
        candidates=[SimpleNamespace(model_profile_id=1)],
        judges=[SimpleNamespace(model_profile_id=2)],
    )

    class Repository:
        async def get_session_with_relations(self, session_id: int):
            return benchmark_session

    service.repository = Repository()  # type: ignore[assignment]

    with pytest.raises(RunLaunchValidationError):
        await service.launch_run(1)


def test_serialize_run_status_values() -> None:
    from app.features.runs.models import SessionRun
    from app.features.runs.service import serialize_run

    run = SessionRun(
        id=1,
        session_id=10,
        name="Session Run",
        status="pending",
        launched_at=datetime.now(UTC),
        completed_at=None,
        rubric_version="mvp-v1",
        report_status="pending",
        html_report_path=None,
        pdf_report_path=None,
        notes=None,
    )
    run.prompt_snapshots = []
    run.model_snapshots = []

    serialized = serialize_run(run)

    assert serialized.status == "pending"
    assert serialized.report_status == "pending"
