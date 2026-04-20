import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.features.execution.adapters.anthropic import AnthropicAdapter
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

    service.repository = Repository()  # type: ignore[assignment]

    with pytest.raises(JudgingError):
        await service.retry_judging(1)


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

    async def fake_run_aggregation_stage(_: int) -> None:
        run.status = "reporting"

    service._run_aggregation_stage = fake_run_aggregation_stage  # type: ignore[method-assign]

    payload = await service.retry_judging(1)

    assert payload.run_status == "reporting"
    assert payload.completed_batches == 3
    assert created_batches[0].status == "completed"
    assert created_batches[1].status == "completed"
    assert created_batches[2].status == "completed"
    assert created_batches[2].batch_type == "arena"
    assert created_batches[0].evaluation is not None
    assert (
        created_batches[0].evaluation.candidates[0].candidate_response_id
        in {100, 101}
    )
