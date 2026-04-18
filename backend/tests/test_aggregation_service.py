from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.features.aggregation.service import AggregationService


@pytest.mark.asyncio
async def test_aggregate_run_computes_summaries_and_moves_to_reporting() -> None:
    service = AggregationService(SimpleNamespace())
    created_summaries = []
    candidate_response_a = SimpleNamespace(
        id=100,
        model_snapshot_id=20,
        metric=SimpleNamespace(
            duration_ms=1000,
            total_tokens=400,
            tokens_per_second="40.0",
            estimated_cost="1.20",
        ),
    )
    candidate_response_b = SimpleNamespace(
        id=101,
        model_snapshot_id=21,
        metric=SimpleNamespace(
            duration_ms=800,
            total_tokens=350,
            tokens_per_second="50.0",
            estimated_cost="0.90",
        ),
    )
    evaluation = SimpleNamespace(
        candidates=[
            SimpleNamespace(
                candidate_response_id=100,
                overall_score=Decimal("80"),
                relevance_score=Decimal("81"),
                accuracy_score=Decimal("82"),
                completeness_score=Decimal("79"),
                clarity_score=Decimal("83"),
                instruction_following_score=Decimal("80"),
                strengths_text="clear; grounded",
                weaknesses_text="slightly verbose",
            ),
            SimpleNamespace(
                candidate_response_id=101,
                overall_score=Decimal("90"),
                relevance_score=Decimal("89"),
                accuracy_score=Decimal("91"),
                completeness_score=Decimal("90"),
                clarity_score=Decimal("92"),
                instruction_following_score=Decimal("88"),
                strengths_text="concise; clear",
                weaknesses_text="minor omission",
            ),
        ]
    )
    run = SimpleNamespace(
        id=1,
        status="aggregating",
        report_status="pending",
        model_snapshots=[
            SimpleNamespace(id=20, role="candidate"),
            SimpleNamespace(id=21, role="candidate"),
        ],
        prompt_snapshots=[SimpleNamespace(id=10), SimpleNamespace(id=11)],
        candidate_responses=[candidate_response_a, candidate_response_b],
        judge_batches=[SimpleNamespace(evaluation=evaluation)],
        global_summaries=[],
    )

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def clear_global_summaries(self, run_id: int) -> None:
            created_summaries.clear()

        def add_global_summary(self, summary) -> None:
            created_summaries.append(summary)

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    async def fake_run_report_generation(_: int) -> None:
        return None

    service._run_report_generation = fake_run_report_generation  # type: ignore[method-assign]

    await service.aggregate_run(1)

    assert run.status == "reporting"
    assert len(created_summaries) == 2
    assert created_summaries[0].final_global_score is not None
    assert created_summaries[1].total_estimated_cost == "0.90"
