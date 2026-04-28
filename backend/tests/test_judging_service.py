import json
from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest

from app.features.execution.adapters.anthropic import AnthropicAdapter
from app.features.execution.adapters.base import AdapterExecutionResult
from app.features.judging.service import JudgingError, JudgingService


@pytest.mark.asyncio
async def test_retry_judging_requires_completed_candidate_matrix() -> None:
    service = JudgingService(SimpleNamespace())
    run = SimpleNamespace(
        id=1,
        status="judging",
        prompt_snapshots=[SimpleNamespace(id=10, snapshot_order=1)],
        model_snapshots=[
            SimpleNamespace(id=20, role="candidate"),
            SimpleNamespace(id=21, role="judge"),
        ],
        candidate_responses=[],
    )

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def list_batches(self, run_id: int):
            return []

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    with pytest.raises(JudgingError):
        await service.start_judging(1)


def test_judge_prompt_includes_structured_scenario_context() -> None:
    service = JudgingService(SimpleNamespace())
    prompt_snapshot = SimpleNamespace(
        user_prompt_text="Rendered scenario prompt",
        evaluation_notes=None,
        scenario_type="code_debug",
        constraints_jsonb=["No dependency."],
        expected_output_format="Bullets.",
        gold_facts_jsonb={"must_include": ["skill_ids"]},
        judge_rubric_jsonb={"criteria": [{"key": "correctness"}]},
    )
    candidate = SimpleNamespace(normalized_response_text="Answer")

    judge_prompt = service._build_judge_prompt(
        "absolute",
        prompt_snapshot,
        {"A": candidate},
    )

    assert "Scenario evaluation context" in judge_prompt
    assert '"scenario_type": "code_debug"' in judge_prompt
    assert '"gold_facts"' in judge_prompt
    assert '"judge_rubric"' in judge_prompt
    assert "Do not reward verbosity" in judge_prompt
    assert "criterion_scores" in judge_prompt


@pytest.mark.asyncio
async def test_start_judging_rejects_runs_that_already_have_batches() -> None:
    service = JudgingService(SimpleNamespace())
    run = SimpleNamespace(
        id=1,
        status="ready_for_judging",
        prompt_snapshots=[],
        model_snapshots=[],
        candidate_responses=[],
    )

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def list_batches(self, run_id: int):
            return [SimpleNamespace(id=1)]

    service.repository = Repository()  # type: ignore[assignment]

    with pytest.raises(JudgingError, match="already started"):
        await service.start_judging(1)


def test_parse_judge_output_validates_labels_and_scores() -> None:
    service = JudgingService(SimpleNamespace())
    anonymized = {
        "A": SimpleNamespace(id=1),
        "B": SimpleNamespace(id=2),
    }
    raw = json.dumps(
        {
            "prompt_assessment": {
                "prompt_id": "10",
                "batch_size": 2,
                "candidates": [
                    {
                        "candidate_label": "A",
                        "overall_score": 91,
                        "relevance": 92,
                        "accuracy": 90,
                        "completeness": 89,
                        "clarity": 93,
                        "instruction_following": 95,
                        "ranking_in_batch": 1,
                        "strengths": ["clear"],
                        "weaknesses": ["minor omission"],
                        "short_feedback": "Strong",
                        "detailed_feedback": "Good answer",
                        "confidence": 5,
                    },
                    {
                        "candidate_label": "B",
                        "overall_score": 83,
                        "relevance": 82,
                        "accuracy": 84,
                        "completeness": 80,
                        "clarity": 85,
                        "instruction_following": 83,
                        "ranking_in_batch": 2,
                        "strengths": ["concise"],
                        "weaknesses": [],
                        "short_feedback": "Solid",
                        "detailed_feedback": "Reasonable answer",
                        "confidence": 4,
                    },
                ],
            }
        }
    )

    parsed = service._parse_judge_output(raw, anonymized)

    assert parsed["prompt_assessment"]["batch_size"] == 2
    assert parsed["prompt_assessment"]["candidates"][0]["candidate_label"] == "A"


def test_resolve_adapter_uses_anthropic_for_anthropic_api_style() -> None:
    service = JudgingService(SimpleNamespace())

    adapter = service._resolve_adapter(
        SimpleNamespace(api_style="anthropic", provider_type="anthropic")
    )

    assert isinstance(adapter, AnthropicAdapter)


@pytest.mark.asyncio
async def test_generate_with_limits_retries_http_429() -> None:
    service = JudgingService(SimpleNamespace())
    attempts = 0

    class Adapter:
        async def generate(self, **kwargs):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                request = httpx.Request("POST", "https://judge.test")
                response = httpx.Response(429, request=request)
                raise httpx.HTTPStatusError(
                    "Too Many Requests",
                    request=request,
                    response=response,
                )
            return AdapterExecutionResult(
                request_payload={"model": "judge"},
                raw_response_json={},
                raw_response_text="{}",
                normalized_response_text="{}",
                duration_ms=10,
                input_tokens=None,
                output_tokens=None,
                total_tokens=None,
                tokens_per_second=None,
                estimated_cost=None,
                extra_metrics=None,
            )

    async def skip_provider_slot(model_profile) -> None:
        return None

    service._wait_for_provider_slot = skip_provider_slot  # type: ignore[method-assign]
    service._retry_delay_seconds = lambda exc, attempt: 0.0  # type: ignore[method-assign]

    result = await service._generate_with_limits(
        Adapter(),  # type: ignore[arg-type]
        SimpleNamespace(api_style="anthropic", provider_type="anthropic"),
        endpoint_url="https://judge.test",
        model_identifier="judge",
        prompt_text="Judge",
        system_prompt_text=None,
        secret=None,
        timeout_seconds=30,
        pricing_input_per_million=None,
        pricing_output_per_million=None,
    )

    assert attempts == 2
    assert result.request_payload == {"model": "judge"}


@pytest.mark.asyncio
async def test_retry_judging_only_executes_batches_that_were_failed() -> None:
    service = JudgingService(SimpleNamespace())
    run = SimpleNamespace(id=1, status="failed")
    batches = [
        SimpleNamespace(
            id=10,
            run_id=1,
            batch_type="absolute",
            status="pending",
            evaluation=None,
            error_message=None,
            completed_at=None,
        ),
        SimpleNamespace(
            id=11,
            run_id=1,
            batch_type="absolute",
            status="failed",
            evaluation=None,
            error_message="429",
            completed_at=datetime.now(UTC),
        ),
        SimpleNamespace(
            id=12,
            run_id=1,
            batch_type="absolute",
            status="failed",
            evaluation=SimpleNamespace(id=99),
            error_message="stale",
            completed_at=datetime.now(UTC),
        ),
    ]
    executed_ids: list[int] = []

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def list_batches(self, run_id: int):
            return batches

        async def commit(self) -> None:
            return None

    async def fake_execute_batch_isolated(run_id: int, batch_id: int):
        executed_ids.append(batch_id)
        batch = next(item for item in batches if item.id == batch_id)
        batch.status = "completed"
        batch.evaluation = SimpleNamespace(id=batch_id)
        return None

    async def fake_ensure_arena_batches(run, refreshed) -> None:
        return None

    async def fake_run_aggregation_stage(run_id: int) -> None:
        return None

    service.repository = Repository()  # type: ignore[assignment]
    service._execute_batch_isolated = fake_execute_batch_isolated  # type: ignore[method-assign]
    service._ensure_arena_batches = fake_ensure_arena_batches  # type: ignore[method-assign]
    service._run_aggregation_stage = fake_run_aggregation_stage  # type: ignore[method-assign]
    service._serialize_run_judging = lambda run, batches: SimpleNamespace()  # type: ignore[method-assign]

    await service.retry_judging(1)

    assert executed_ids == [11]
    assert batches[0].status == "pending"
    assert batches[2].status == "failed"
    assert batches[2].evaluation is not None


@pytest.mark.asyncio
async def test_retry_judging_completes_batches_and_updates_run_status() -> None:
    service = JudgingService(SimpleNamespace())
    candidate_a = SimpleNamespace(
        id=100,
        prompt_snapshot_id=10,
        model_snapshot_id=20,
        status="completed",
        normalized_response_text="Answer A",
    )
    candidate_b = SimpleNamespace(
        id=101,
        prompt_snapshot_id=10,
        model_snapshot_id=21,
        status="completed",
        normalized_response_text="Answer B",
    )
    run = SimpleNamespace(
        id=1,
        status="judging",
        prompt_snapshots=[
            SimpleNamespace(
                id=10,
                snapshot_order=1,
                user_prompt_text="Prompt",
                evaluation_notes=None,
            )
        ],
        model_snapshots=[
            SimpleNamespace(
                id=20,
                role="candidate",
                runtime_type="remote",
                source_model_profile_id=200,
            ),
            SimpleNamespace(
                id=21,
                role="candidate",
                runtime_type="remote",
                source_model_profile_id=201,
            ),
            SimpleNamespace(
                id=30,
                role="judge",
                endpoint_url="https://judge.test",
                model_identifier="judge-model",
                timeout_seconds=30,
                pricing_input_per_million=None,
                pricing_output_per_million=None,
                source_model_profile_id=300,
            ),
        ],
        candidate_responses=[candidate_a, candidate_b],
    )
    created_batches = []

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def list_batches(self, run_id: int):
            return created_batches

        def add_batch(self, batch) -> None:
            batch.id = len(created_batches) + 1
            batch.evaluation = None
            created_batches.append(batch)

        async def commit(self) -> None:
            for batch_index, batch in enumerate(created_batches, start=1):
                if batch.evaluation is None:
                    continue
                batch.evaluation.id = batch_index
                batch.evaluation.judge_batch_id = batch.id
                batch.evaluation.created_at = datetime.now(UTC)
                for candidate_index, candidate in enumerate(
                    batch.evaluation.candidates,
                    start=1,
                ):
                    candidate.id = candidate_index
            return None

    class ModelRepository:
        async def get_model_profile(self, model_id: int):
            return SimpleNamespace(
                api_style="openai_compatible",
                provider_type="openai",
                secret_encrypted=None,
            )

    class Adapter:
        async def generate(self, **kwargs):
            prompt_text = kwargs["prompt_text"]
            if "single anonymized candidate response" in prompt_text:
                candidates = [
                    {
                        "candidate_label": "A",
                        "overall_score": 90,
                        "relevance": 90,
                        "accuracy": 90,
                        "completeness": 90,
                        "clarity": 90,
                        "instruction_following": 90,
                        "ranking_in_batch": 1,
                        "strengths": ["clear"],
                        "weaknesses": ["none"],
                        "short_feedback": "Best",
                        "detailed_feedback": "Best answer",
                        "confidence": 5,
                    }
                ]
            else:
                candidates = [
                    {
                        "candidate_label": "A",
                        "overall_score": 90,
                        "relevance": 90,
                        "accuracy": 90,
                        "completeness": 90,
                        "clarity": 90,
                        "instruction_following": 90,
                        "ranking_in_batch": 1,
                        "strengths": ["clear"],
                        "weaknesses": ["none"],
                        "short_feedback": "Best",
                        "detailed_feedback": "Best answer",
                        "confidence": 4,
                    },
                    {
                        "candidate_label": "B",
                        "overall_score": 80,
                        "relevance": 80,
                        "accuracy": 80,
                        "completeness": 80,
                        "clarity": 80,
                        "instruction_following": 80,
                        "ranking_in_batch": 2,
                        "strengths": ["concise"],
                        "weaknesses": ["thin"],
                        "short_feedback": "Second",
                        "detailed_feedback": "Second answer",
                        "confidence": 3,
                    },
                ]
            return SimpleNamespace(
                request_payload={"model": "judge-model"},
                raw_response_json={"ok": True},
                raw_response_text='{"ok": true}',
                estimated_cost=None,
                normalized_response_text=json.dumps(
                    {
                        "prompt_assessment": {
                            "prompt_id": "10",
                            "batch_size": len(candidates),
                            "candidates": candidates,
                        }
                    }
                ),
            )

    service.repository = Repository()  # type: ignore[assignment]
    service.model_repository = ModelRepository()  # type: ignore[assignment]
    service._resolve_adapter = lambda _: Adapter()  # type: ignore[method-assign]

    async def fake_execute_batch_isolated(run_id: int, batch_id: int):
        batch = next(item for item in created_batches if item.id == batch_id)
        await service._execute_batch(run, batch)
        return None

    service._execute_batch_isolated = fake_execute_batch_isolated  # type: ignore[method-assign]

    async def fake_run_aggregation_stage(_: int) -> None:
        run.status = "reporting"

    service._run_aggregation_stage = fake_run_aggregation_stage  # type: ignore[method-assign]

    payload = await service.start_judging(1)

    assert payload.run_status == "reporting"
    assert payload.completed_batches == 3
    assert created_batches[0].status == "completed"
    assert created_batches[1].status == "completed"
    assert created_batches[2].status == "completed"
    assert created_batches[2].batch_type == "arena"
    assert created_batches[0].evaluation is not None
    assert created_batches[0].evaluation.candidates[0].candidate_response_id in {
        100,
        101,
    }
