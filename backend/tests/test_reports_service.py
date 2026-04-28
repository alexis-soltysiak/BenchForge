from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.features.reports.service import ReportsService


def build_run() -> SimpleNamespace:
    candidate_model = SimpleNamespace(
        id=20,
        role="candidate",
        display_name="Model A",
        provider_type="openai",
        runtime_type="remote",
    )
    judge_model = SimpleNamespace(
        id=30,
        role="judge",
        display_name="Judge 1",
        provider_type="openai",
        runtime_type="remote",
    )
    response = SimpleNamespace(
        id=100,
        prompt_snapshot_id=10,
        model_snapshot_id=20,
        status="completed",
        normalized_response_text="Answer body",
        metric=SimpleNamespace(
            duration_ms=1200,
            total_tokens=300,
            estimated_cost="1.10",
        ),
    )
    evaluation_candidate = SimpleNamespace(
        candidate_response_id=100,
        overall_score=Decimal("88"),
        ranking_in_batch=1,
        short_feedback="Strong answer",
        detailed_feedback="Detailed review",
        strengths_text="clear",
        weaknesses_text="slightly verbose",
    )
    return SimpleNamespace(
        id=1,
        name="Session Run",
        launched_at=datetime.now(UTC),
        status="reporting",
        report_status="pending",
        html_report_path=None,
        model_snapshots=[candidate_model, judge_model],
        prompt_snapshots=[
            SimpleNamespace(
                id=10,
                name="Prompt 1",
                category_name="General QA",
                system_prompt_text=None,
                user_prompt_text="Explain X",
                evaluation_notes=None,
                snapshot_order=1,
            )
        ],
        candidate_responses=[response],
        global_summaries=[
            SimpleNamespace(
                id=1,
                model_snapshot_id=20,
                average_overall_score="88.00",
                average_relevance_score="88.00",
                average_accuracy_score="88.00",
                average_completeness_score="88.00",
                average_clarity_score="88.00",
                average_instruction_following_score="88.00",
                avg_duration_ms=1200,
                avg_total_tokens=300,
                avg_tokens_per_second="25.00",
                total_estimated_cost="1.10",
                global_summary_text="Average overall score 88.",
                best_patterns_text="clear",
                weak_patterns_text="slightly verbose",
                final_global_score="90.00",
            )
        ],
        judge_batches=[
            SimpleNamespace(
                evaluation=SimpleNamespace(candidates=[evaluation_candidate])
            )
        ],
    )


@pytest.mark.asyncio
async def test_generate_report_writes_html_and_completes_run(tmp_path: Path) -> None:
    service = ReportsService(SimpleNamespace(), output_dir=tmp_path)
    run = build_run()

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    artifact = await service.generate_report(1)

    assert artifact.report_status == "completed"
    assert artifact.html_report_path is not None
    assert Path(artifact.html_report_path).exists()
    assert artifact.pdf_report_path is None
    assert run.status == "completed"


@pytest.mark.asyncio
async def test_generate_report_aggregates_missing_summaries(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = ReportsService(SimpleNamespace(), output_dir=tmp_path)
    run = build_run()
    summaries = run.global_summaries
    run.global_summaries = []
    aggregate_calls: list[tuple[int, bool]] = []

    async def fake_aggregate_run(
        self,
        run_id: int,
        *,
        generate_report: bool = True,
    ) -> None:
        aggregate_calls.append((run_id, generate_report))
        run.global_summaries = summaries

    monkeypatch.setattr(
        "app.features.aggregation.service.AggregationService.aggregate_run",
        fake_aggregate_run,
    )

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    artifact = await service.generate_report(1)

    assert aggregate_calls == [(1, False)]
    assert artifact.report_status == "completed"
    assert artifact.html_report_path is not None


@pytest.mark.asyncio
async def test_generate_report_succeeds_when_aggregation_cannot_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = ReportsService(SimpleNamespace(), output_dir=tmp_path)
    run = build_run()
    run.global_summaries = []

    async def fake_aggregate_run(
        self,
        run_id: int,
        *,
        generate_report: bool = True,
    ) -> None:
        from app.features.aggregation.service import AggregationError

        raise AggregationError("not ready")

    monkeypatch.setattr(
        "app.features.aggregation.service.AggregationService.aggregate_run",
        fake_aggregate_run,
    )

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    artifact = await service.generate_report(1)

    assert artifact.report_status == "completed"
    assert artifact.html_report_path is not None
    assert Path(artifact.html_report_path).exists()


@pytest.mark.asyncio
async def test_generate_report_writes_minimal_html_when_rendering_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = ReportsService(SimpleNamespace(), output_dir=tmp_path)
    run = build_run()

    def fail_render(report) -> str:
        raise RuntimeError("broken chart")

    monkeypatch.setattr(service, "_render_html", fail_render)

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    artifact = await service.generate_report(1)

    assert artifact.report_status == "completed"
    assert artifact.html_report_path is not None
    assert "fallback artifact" in Path(artifact.html_report_path).read_text()


@pytest.mark.asyncio
async def test_get_report_returns_view_model() -> None:
    service = ReportsService(SimpleNamespace())
    run = build_run()

    class Repository:
        async def get_run(self, run_id: int):
            return run

    service.repository = Repository()  # type: ignore[assignment]

    report = await service.get_report(1)

    assert report.judge_name == "Judge 1"
    assert report.summary_matrix[0].candidate_name == "Model A"
    assert report.prompt_sections[0].candidates[0].overall_score == "88"
