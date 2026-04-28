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


@pytest.mark.asyncio
async def test_build_prompt_snapshot_renders_structured_scenario() -> None:
    service = RunService(SimpleNamespace())
    prompt = SimpleNamespace(
        id=7,
        updated_at=datetime.now(UTC),
        name="Structured",
        category=SimpleNamespace(name="Code Debug"),
        system_prompt_text="System",
        user_prompt_text="Patch it.",
        evaluation_notes="Check facts.",
        scenario_type="code_debug",
        objective="Find the bug.",
        context="Skills are not linked.",
        input_artifacts_jsonb=[
            {"name": "router.py", "kind": "code", "language": "python", "content": "pass"}
        ],
        constraints_jsonb=["No dependency."],
        expected_behavior_jsonb=None,
        gold_facts_jsonb={"must_include": ["skill_ids"]},
        judge_rubric_jsonb={"criteria": [{"key": "correctness"}]},
        estimated_input_tokens=120,
        expected_output_format="Bullets.",
        cost_tier="low",
        weight=2,
        version="1.0",
    )

    class Repository:
        async def get_prompt(self, prompt_id: int):
            return prompt

    service.repository = Repository()  # type: ignore[assignment]

    snapshot = await service._build_prompt_snapshot(7, 1)

    assert snapshot.user_prompt_text.startswith("## Objective\nFind the bug.")
    assert "### router.py (code, python)" in snapshot.user_prompt_text
    assert snapshot.gold_facts_jsonb == {"must_include": ["skill_ids"]}
    assert snapshot.judge_rubric_jsonb == {"criteria": [{"key": "correctness"}]}
    assert snapshot.weight == 2
