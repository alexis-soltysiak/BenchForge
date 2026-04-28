from __future__ import annotations

import asyncio
import json
import math
import os
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from html import escape
from pathlib import Path
from types import SimpleNamespace

import plotly.graph_objects as go
import plotly.io as pio
from playwright.async_api import async_playwright
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.reports.repository import ReportsRepository
from app.features.reports.schemas import (
    ReportArtifactRead,
    ReportCandidateSectionRead,
    ReportPromptCandidateRead,
    ReportPromptSectionRead,
    ReportSummaryRowRead,
    RunReportRead,
)
from app.features.runs.models import CandidateResponse, SessionRun

# Mirrors aggregation/service.py weights — kept here for display only
_QUALITY_WEIGHT_PCT = 70
_COST_WEIGHT_PCT = 15
_PERFORMANCE_WEIGHT_PCT = 15

# 12 perceptually distinct colors; cycles only beyond 12 candidates
_CHART_PALETTE = [
    "#3b82f6",  # Blue
    "#f97316",  # Orange
    "#10b981",  # Emerald
    "#a855f7",  # Purple
    "#ef4444",  # Red
    "#f59e0b",  # Amber
    "#06b6d4",  # Cyan
    "#ec4899",  # Pink
    "#84cc16",  # Lime
    "#6366f1",  # Indigo
    "#14b8a6",  # Teal
    "#f43f5e",  # Rose
]


def _hex_rgba(hex_color: str, alpha: float) -> str:
    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)
    return f"rgba({r},{g},{b},{alpha})"


class ReportError(ValueError):
    pass


@dataclass
class ReportsService:
    session: AsyncSession
    output_dir: Path | None = None
    repository: ReportsRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = ReportsRepository(self.session)
        self.output_dir = (self.output_dir or Path("generated_reports")).resolve()

    async def get_report(self, run_id: int) -> RunReportRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise ReportError(f"Run {run_id} not found.")
        return self._build_report_view_model(run)

    async def generate_report(self, run_id: int) -> ReportArtifactRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise ReportError(f"Run {run_id} not found.")
        run = await self._ensure_global_summaries(run_id, run)
        try:
            report = self._build_report_view_model(run)
            html = self._render_html(report)
        except Exception as exc:
            html = self._render_minimal_report(run, exc)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        html_output_path = self.output_dir / f"run-{run.id}.html"
        pdf_output_path = self.output_dir / f"run-{run.id}.pdf"
        html_output_path.write_text(html, encoding="utf-8")
        pdf_report_path: str | None = None
        if self._pdf_reports_enabled():
            try:
                await asyncio.wait_for(
                    self._render_pdf(html, pdf_output_path),
                    timeout=15,
                )
                pdf_report_path = str(pdf_output_path)
            except Exception:
                if pdf_output_path.exists():
                    pdf_output_path.unlink()

        run.html_report_path = str(html_output_path)
        run.pdf_report_path = pdf_report_path
        run.report_status = "completed"
        run.status = "completed"
        await self.repository.commit()
        return ReportArtifactRead(
            run_id=run.id,
            report_status=run.report_status,
            html_report_path=run.html_report_path,
            pdf_report_path=run.pdf_report_path,
        )

    def _pdf_reports_enabled(self) -> bool:
        return os.getenv("BENCHFORGE_ENABLE_PDF_REPORTS", "").lower() in {
            "1",
            "true",
            "yes",
        }

    def _render_minimal_report(self, run: SessionRun, error: Exception) -> str:
        title = escape(f"{getattr(run, 'name', f'Run {run.id}')} Report")
        prompt_count = len(getattr(run, "prompt_snapshots", []))
        response_count = len(getattr(run, "candidate_responses", []))
        error_text = escape(str(error) or error.__class__.__name__)
        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <style>
    body {{
      font-family: Inter, system-ui, sans-serif;
      margin: 40px;
      color: #0f172a;
      background: #f8fafc;
    }}
    main {{
      max-width: 960px;
      margin: 0 auto;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 28px;
    }}
    h1 {{ margin: 0 0 12px; font-size: 30px; }}
    p {{ color: #475569; line-height: 1.55; }}
    .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }}
    .box {{ border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }}
    .label {{ color: #64748b; font-size: 12px; text-transform: uppercase; }}
    .value {{ font-size: 22px; font-weight: 700; margin-top: 4px; }}
    pre {{
      white-space: pre-wrap;
      background: #f1f5f9;
      border-radius: 12px;
      padding: 14px;
      color: #334155;
    }}
  </style>
</head>
<body>
  <main>
    <h1>{title}</h1>
    <p>The full report could not be rendered, so BenchForge generated this
    fallback artifact with the available run metadata.</p>
    <div class="grid">
      <div class="box">
        <div class="label">Run ID</div><div class="value">{run.id}</div>
      </div>
      <div class="box">
        <div class="label">Scenarios</div><div class="value">{prompt_count}</div>
      </div>
      <div class="box">
        <div class="label">Responses</div><div class="value">{response_count}</div>
      </div>
    </div>
    <h2>Render issue</h2>
    <pre>{error_text}</pre>
  </main>
</body>
</html>"""

    async def _ensure_global_summaries(
        self,
        run_id: int,
        run: SessionRun,
    ) -> SessionRun:
        if run.global_summaries:
            return run

        from app.features.aggregation.service import (
            AggregationError,
            AggregationService,
        )

        try:
            await AggregationService(self.session).aggregate_run(
                run_id,
                generate_report=False,
            )
        except AggregationError:
            return run

        refreshed_run = await self.repository.get_run(run_id)
        if refreshed_run is None:
            raise ReportError(f"Run {run_id} not found.")
        return refreshed_run

    async def get_report_html(self, run_id: int) -> tuple[str, str]:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise ReportError(f"Run {run_id} not found.")

        if run.html_report_path:
            path = Path(run.html_report_path)
            if path.exists():
                return path.read_text(encoding="utf-8"), str(path)

        artifact = await self.generate_report(run_id)
        if artifact.html_report_path is None:
            raise ReportError("HTML report path is unavailable.")
        html_path = Path(artifact.html_report_path)
        return html_path.read_text(encoding="utf-8"), str(html_path)

    async def get_report_pdf(self, run_id: int) -> str:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise ReportError(f"Run {run_id} not found.")

        if run.pdf_report_path:
            path = Path(run.pdf_report_path)
            if path.exists():
                return str(path)

        artifact = await self.generate_report(run_id)
        if artifact.pdf_report_path is None:
            raise ReportError("PDF report path is unavailable.")
        return artifact.pdf_report_path

    async def get_report_svg_zip(self, run_id: int) -> bytes:
        import io
        import zipfile

        html, _ = await self.get_report_html(run_id)
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_content(html, wait_until="networkidle")
            await page.wait_for_function(
                "() => document.querySelectorAll('.js-plotly-plot .main-svg').length > 0",
                timeout=20_000,
            )
            svgs: list[str] = await page.evaluate(
                "() => Array.from(document.querySelectorAll('.js-plotly-plot .main-svg')).map(s => s.outerHTML)"
            )
            await browser.close()

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, svg_content in enumerate(svgs):
                zf.writestr(f"chart-{i + 1}.svg", svg_content)
        return buf.getvalue()

    def _build_report_view_model(self, run: SessionRun) -> RunReportRead:
        candidate_snapshots = [
            snapshot
            for snapshot in run.model_snapshots
            if snapshot.role == "candidate"
        ]
        judge_snapshots = [s for s in run.model_snapshots if s.role == "judge"]
        if run.global_summaries:
            summary_matrix = self._build_summary_matrix_from_summaries(run)
            candidate_sections = self._build_candidate_sections_from_summaries(run)
        else:
            summary_matrix = self._build_fallback_summary_matrix(
                run,
                candidate_snapshots,
            )
            candidate_sections = self._build_fallback_candidate_sections(
                run,
                candidate_snapshots,
            )

        prompt_sections = [
            ReportPromptSectionRead(
                prompt_snapshot_id=prompt.id,
                prompt_name=prompt.name,
                category_name=getattr(prompt, "category_name", "Uncategorized"),
                system_prompt_text=getattr(prompt, "system_prompt_text", None),
                user_prompt_text=getattr(prompt, "user_prompt_text", ""),
                evaluation_notes=getattr(prompt, "evaluation_notes", None),
                scenario_type=getattr(prompt, "scenario_type", None),
                constraints_jsonb=getattr(prompt, "constraints_jsonb", None),
                gold_facts_jsonb=getattr(prompt, "gold_facts_jsonb", None),
                judge_rubric_jsonb=getattr(prompt, "judge_rubric_jsonb", None),
                expected_output_format=getattr(prompt, "expected_output_format", None),
                cost_tier=getattr(prompt, "cost_tier", None),
                weight=getattr(prompt, "weight", None),
                version=getattr(prompt, "version", None),
                candidates=[
                    self._build_prompt_candidate(run, response)
                    for response in sorted(
                        [
                            item
                            for item in run.candidate_responses
                            if item.prompt_snapshot_id == prompt.id
                        ],
                        key=lambda item: self._model_name(run, item.model_snapshot_id),
                    )
                ],
            )
            for prompt in sorted(
                run.prompt_snapshots,
                key=lambda item: getattr(item, "snapshot_order", 0),
            )
        ]

        return RunReportRead(
            run_id=run.id,
            report_title=f"{run.name} Report",
            benchmark_session_name=run.name,
            launched_at=run.launched_at,
            judge_name=(
                " · ".join(s.display_name for s in judge_snapshots)
                if judge_snapshots
                else "No judge selected"
            ),
            prompt_count=len(run.prompt_snapshots),
            candidate_count=len(candidate_snapshots),
            summary_matrix=summary_matrix,
            candidate_sections=candidate_sections,
            prompt_sections=prompt_sections,
        )

    def _build_summary_matrix_from_summaries(
        self,
        run: SessionRun,
    ) -> list[ReportSummaryRowRead]:
        cost_scores = self._normalize_inverse(
            {
                summary.model_snapshot_id: (
                    Decimal(summary.total_estimated_cost)
                    if summary.total_estimated_cost is not None
                    else None
                )
                for summary in run.global_summaries
            }
        )
        performance_scores = self._normalize_performance(run)
        return [
            ReportSummaryRowRead(
                model_snapshot_id=summary.model_snapshot_id,
                candidate_name=self._model_name(run, summary.model_snapshot_id),
                judge_score=summary.average_overall_score,
                quality_score=self._compute_sub_score_avg(summary),
                cost_score=str(cost_scores[summary.model_snapshot_id]),
                performance_score=str(performance_scores[summary.model_snapshot_id]),
                final_global_score=summary.final_global_score,
                avg_duration_ms=summary.avg_duration_ms,
                total_estimated_cost=summary.total_estimated_cost,
            )
            for summary in sorted(
                run.global_summaries,
                key=lambda item: Decimal(item.final_global_score or "0"),
                reverse=True,
            )
        ]

    def _build_candidate_sections_from_summaries(
        self,
        run: SessionRun,
    ) -> list[ReportCandidateSectionRead]:
        return [
            ReportCandidateSectionRead(
                model_snapshot_id=summary.model_snapshot_id,
                candidate_name=self._model_name(run, summary.model_snapshot_id),
                provider_type=self._model_snapshot(
                    run,
                    summary.model_snapshot_id,
                ).provider_type,
                runtime_type=self._model_snapshot(
                    run,
                    summary.model_snapshot_id,
                ).runtime_type,
                average_overall_score=summary.average_overall_score,
                average_relevance_score=summary.average_relevance_score,
                average_accuracy_score=summary.average_accuracy_score,
                average_completeness_score=summary.average_completeness_score,
                average_clarity_score=summary.average_clarity_score,
                average_instruction_following_score=(
                    summary.average_instruction_following_score
                ),
                avg_duration_ms=summary.avg_duration_ms,
                avg_total_tokens=summary.avg_total_tokens,
                avg_tokens_per_second=summary.avg_tokens_per_second,
                total_estimated_cost=summary.total_estimated_cost,
                global_summary_text=summary.global_summary_text,
                best_patterns_text=summary.best_patterns_text,
                weak_patterns_text=summary.weak_patterns_text,
                final_global_score=summary.final_global_score,
            )
            for summary in sorted(
                run.global_summaries,
                key=lambda item: Decimal(item.final_global_score or "0"),
                reverse=True,
            )
        ]

    def _build_fallback_summary_matrix(
        self,
        run: SessionRun,
        candidate_snapshots: list,
    ) -> list[ReportSummaryRowRead]:
        rows = [
            self._build_fallback_summary_row(run, snapshot)
            for snapshot in candidate_snapshots
        ]
        return sorted(
            rows,
            key=lambda item: Decimal(item.final_global_score or "0"),
            reverse=True,
        )

    def _build_fallback_candidate_sections(
        self,
        run: SessionRun,
        candidate_snapshots: list,
    ) -> list[ReportCandidateSectionRead]:
        return [
            ReportCandidateSectionRead(
                model_snapshot_id=row.model_snapshot_id,
                candidate_name=row.candidate_name,
                provider_type=getattr(snapshot, "provider_type", "unknown"),
                runtime_type=getattr(snapshot, "runtime_type", "unknown"),
                average_overall_score=row.judge_score,
                average_relevance_score=row.quality_score,
                average_accuracy_score=row.quality_score,
                average_completeness_score=row.quality_score,
                average_clarity_score=row.quality_score,
                average_instruction_following_score=row.quality_score,
                avg_duration_ms=row.avg_duration_ms,
                avg_total_tokens=self._average_response_tokens(
                    run,
                    snapshot.id,
                ),
                avg_tokens_per_second=self._average_response_tokens_per_second(
                    run,
                    snapshot.id,
                ),
                total_estimated_cost=row.total_estimated_cost,
                global_summary_text="Fallback report generated before aggregation.",
                best_patterns_text=None,
                weak_patterns_text=None,
                final_global_score=row.final_global_score,
            )
            for snapshot in candidate_snapshots
            for row in [self._build_fallback_summary_row(run, snapshot)]
        ]

    def _build_fallback_summary_row(
        self,
        run: SessionRun,
        snapshot,
    ) -> ReportSummaryRowRead:
        responses = self._candidate_responses_for_snapshot(run, snapshot.id)
        score = self._average_absolute_score(run, snapshot.id)
        avg_duration_ms = self._average_response_duration(run, snapshot.id)
        total_cost = self._total_response_cost(responses)
        return ReportSummaryRowRead(
            model_snapshot_id=snapshot.id,
            candidate_name=getattr(snapshot, "display_name", f"Model {snapshot.id}"),
            judge_score=score,
            quality_score=score,
            cost_score="0.00",
            performance_score="0.00",
            final_global_score=score,
            avg_duration_ms=avg_duration_ms,
            total_estimated_cost=total_cost,
        )

    def _candidate_responses_for_snapshot(
        self,
        run: SessionRun,
        model_snapshot_id: int,
    ) -> list:
        return [
            response
            for response in run.candidate_responses
            if response.model_snapshot_id == model_snapshot_id
        ]

    def _average_absolute_score(
        self,
        run: SessionRun,
        model_snapshot_id: int,
    ) -> str:
        response_ids = {
            response.id
            for response in self._candidate_responses_for_snapshot(
                run,
                model_snapshot_id,
            )
        }
        scores = [
            Decimal(str(candidate.overall_score))
            for batch in run.judge_batches
            if getattr(batch, "batch_type", "absolute") == "absolute"
            and batch.evaluation is not None
            for candidate in batch.evaluation.candidates
            if candidate.candidate_response_id in response_ids
            and candidate.overall_score is not None
        ]
        if not scores:
            return "0.00"
        return str((sum(scores) / len(scores)).quantize(Decimal("0.01")))

    def _average_response_duration(
        self,
        run: SessionRun,
        model_snapshot_id: int,
    ) -> int | None:
        values = [
            response.metric.duration_ms
            for response in self._candidate_responses_for_snapshot(
                run,
                model_snapshot_id,
            )
            if response.metric is not None and response.metric.duration_ms is not None
        ]
        if not values:
            return None
        return round(sum(values) / len(values))

    def _average_response_tokens(
        self,
        run: SessionRun,
        model_snapshot_id: int,
    ) -> int | None:
        values = [
            response.metric.total_tokens
            for response in self._candidate_responses_for_snapshot(
                run,
                model_snapshot_id,
            )
            if response.metric is not None and response.metric.total_tokens is not None
        ]
        if not values:
            return None
        return round(sum(values) / len(values))

    def _average_response_tokens_per_second(
        self,
        run: SessionRun,
        model_snapshot_id: int,
    ) -> str | None:
        values = [
            Decimal(str(response.metric.tokens_per_second))
            for response in self._candidate_responses_for_snapshot(
                run,
                model_snapshot_id,
            )
            if response.metric is not None
            and getattr(response.metric, "tokens_per_second", None) is not None
        ]
        if not values:
            return None
        return str((sum(values) / len(values)).quantize(Decimal("0.01")))

    def _total_response_cost(self, responses: list) -> str | None:
        values = [
            Decimal(str(response.metric.estimated_cost))
            for response in responses
            if response.metric is not None
            and response.metric.estimated_cost is not None
        ]
        if not values:
            return None
        return str(sum(values).quantize(Decimal("0.000001")))

    def _build_prompt_candidate(
        self,
        run: SessionRun,
        response: CandidateResponse,
    ) -> ReportPromptCandidateRead:
        evaluation_candidate = next(
            (
                candidate
                for batch in run.judge_batches
                if getattr(batch, "batch_type", "absolute") == "absolute"
                and batch.evaluation is not None
                for candidate in batch.evaluation.candidates
                if candidate.candidate_response_id == response.id
            ),
            None,
        )
        model_snapshot = self._model_snapshot(run, response.model_snapshot_id)
        metric = response.metric
        return ReportPromptCandidateRead(
            candidate_name=model_snapshot.display_name,
            provider_type=model_snapshot.provider_type,
            runtime_type=model_snapshot.runtime_type,
            response_status=response.status,
            normalized_response_text=response.normalized_response_text,
            duration_ms=metric.duration_ms if metric is not None else None,
            total_tokens=metric.total_tokens if metric is not None else None,
            estimated_cost=metric.estimated_cost if metric is not None else None,
            overall_score=(
                str(evaluation_candidate.overall_score)
                if evaluation_candidate is not None
                else None
            ),
            ranking_in_batch=(
                evaluation_candidate.ranking_in_batch
                if evaluation_candidate is not None
                else None
            ),
            short_feedback=(
                evaluation_candidate.short_feedback
                if evaluation_candidate is not None
                else None
            ),
            detailed_feedback=(
                evaluation_candidate.detailed_feedback
                if evaluation_candidate is not None
                else None
            ),
            strengths_text=(
                evaluation_candidate.strengths_text
                if evaluation_candidate is not None
                else None
            ),
            weaknesses_text=(
                evaluation_candidate.weaknesses_text
                if evaluation_candidate is not None
                else None
            ),
            detailed_scores_jsonb=(
                getattr(evaluation_candidate, "detailed_scores_jsonb", None)
                if evaluation_candidate is not None
                else None
            ),
        )

    def _render_report_scenario_context(self, section: ReportPromptSectionRead) -> str:
        blocks: list[str] = []
        if section.expected_output_format:
            blocks.append(
                "<div class='scenario-block'><strong>Expected output</strong>"
                f"<p>{escape(section.expected_output_format)}</p></div>"
            )
        for title, value in [
            ("Constraints", section.constraints_jsonb),
            ("Gold facts", section.gold_facts_jsonb),
            ("Judge rubric", section.judge_rubric_jsonb),
        ]:
            if value:
                blocks.append(
                    f"<div class='scenario-block'><strong>{escape(title)}</strong>"
                    "<pre>"
                    f"{escape(json.dumps(value, indent=2, ensure_ascii=False))}"
                    "</pre>"
                    "</div>"
                )
        if not blocks:
            return ""
        return "<div class='scenario-context'>" + "".join(blocks) + "</div>"

    def _model_snapshot(self, run: SessionRun, model_snapshot_id: int):
        return next(
            (
                snapshot
                for snapshot in run.model_snapshots
                if snapshot.id == model_snapshot_id
            ),
            SimpleNamespace(
                id=model_snapshot_id,
                display_name=f"Model {model_snapshot_id}",
                provider_type="unknown",
                runtime_type="unknown",
            ),
        )

    def _model_name(self, run: SessionRun, model_snapshot_id: int) -> str:
        return self._model_snapshot(run, model_snapshot_id).display_name

    def _compute_sub_score_avg(self, summary) -> str:
        raw = [
            summary.average_relevance_score,
            summary.average_accuracy_score,
            summary.average_completeness_score,
            summary.average_clarity_score,
            summary.average_instruction_following_score,
        ]
        valid = [Decimal(s) for s in raw if s is not None]
        if not valid:
            return summary.average_overall_score
        return str((sum(valid) / len(valid)).quantize(Decimal("0.01")))

    def _normalize_inverse(
        self,
        values: dict[int, Decimal | None],
    ) -> dict[int, Decimal]:
        present = {key: value for key, value in values.items() if value is not None}
        if not present:
            return {key: Decimal("100.00") for key in values}
        low = min(present.values())
        high = max(present.values())
        if low == high:
            return {key: Decimal("100.00") for key in values}

        normalized: dict[int, Decimal] = {}
        spread = high - low
        for key, value in values.items():
            if value is None:
                normalized[key] = Decimal("50.00")
                continue
            normalized[key] = (
                Decimal("100.00") * (high - value) / spread
            ).quantize(Decimal("0.01"))
        return normalized

    def _normalize_direct(
        self,
        values: dict[int, Decimal | None],
    ) -> dict[int, Decimal]:
        present = {key: value for key, value in values.items() if value is not None}
        if not present:
            return {key: Decimal("100.00") for key in values}
        low = min(present.values())
        high = max(present.values())
        if low == high:
            return {key: Decimal("100.00") for key in values}

        normalized: dict[int, Decimal] = {}
        spread = high - low
        for key, value in values.items():
            if value is None:
                normalized[key] = Decimal("50.00")
                continue
            normalized[key] = (
                Decimal("100.00") * (value - low) / spread
            ).quantize(Decimal("0.01"))
        return normalized

    def _normalize_performance(self, run: SessionRun) -> dict[int, Decimal]:
        latency_scores = self._normalize_inverse(
            {
                summary.model_snapshot_id: (
                    Decimal(summary.avg_duration_ms)
                    if summary.avg_duration_ms is not None
                    else None
                )
                for summary in run.global_summaries
            }
        )
        throughput_scores = self._normalize_direct(
            {
                summary.model_snapshot_id: (
                    Decimal(summary.avg_tokens_per_second)
                    if summary.avg_tokens_per_second is not None
                    else None
                )
                for summary in run.global_summaries
            }
        )
        return {
            summary.model_snapshot_id: (
                (
                    latency_scores[summary.model_snapshot_id]
                    + throughput_scores[summary.model_snapshot_id]
                )
                / Decimal("2")
            ).quantize(Decimal("0.01"))
            for summary in run.global_summaries
        }

    def _render_html(self, report: RunReportRead) -> str:  # noqa: PLR0914
        best_score = (
            Decimal(report.summary_matrix[0].final_global_score or "0")
            if report.summary_matrix
            else Decimal("0")
        )

        judge_bias_html = self._judge_bias_notice(report)
        radar_plotly = self._render_radar_plotly(report)
        scatter_plotly = self._render_scatter_plotly(report)
        category_radar_plotly = self._render_category_radar_plotly(report)
        category_html = self._render_category_breakdown_html(report)
        bar_chart_plotly = self._render_bar_chart_plotly(report)

        best_judge = max((float(r.judge_score) for r in report.summary_matrix if r.judge_score), default=None)
        best_quality = max((float(r.quality_score) for r in report.summary_matrix if r.quality_score), default=None)
        best_cost = min((float(r.total_estimated_cost) for r in report.summary_matrix if r.total_estimated_cost), default=None)
        best_latency = min((r.avg_duration_ms for r in report.summary_matrix if r.avg_duration_ms is not None), default=None)

        def _sc(val_str: str | None) -> str:
            try:
                v = float(val_str or "0")
                if v >= 80:
                    return "#10b981"
                if v >= 60:
                    return "#f59e0b"
                return "#ef4444"
            except (ValueError, TypeError):
                return "#94a3b8"

        def _score_bar_html(val_str: str | None) -> str:
            try:
                v = float(val_str or "0")
                pct = min(100.0, max(0.0, v))
            except (ValueError, TypeError):
                v, pct = 0.0, 0.0
            color = _sc(str(v))
            return (
                f"<div class='sb'>"
                f"<div class='sb-track'><div class='sb-fill' style='width:{pct:.1f}%;background:{color}'></div></div>"
                f"<span class='sb-num' style='color:{color}'>{escape(val_str or '\u2014')}</span>"
                f"</div>"
            )

        def _dim_bar(val_str: str | None, label: str) -> str:
            try:
                v = float(val_str or "0")
                pct = min(100.0, max(0.0, v))
            except (ValueError, TypeError):
                v, pct = 0.0, 0.0
            color = _sc(str(v))
            return (
                f"<div class='dim-row'>"
                f"<span class='dim-lbl'>{escape(label)}</span>"
                f"<div class='dim-track'><div class='dim-fill' style='width:{pct:.1f}%;background:{color}'></div></div>"
                f"<span class='dim-val' style='color:{color}'>{escape(val_str or '\u2014')}</span>"
                f"</div>"
            )

        _pod_meta = [
            ("1st", "#eab308", "#fefce8"),
            ("2nd", "#94a3b8", "#f8fafc"),
            ("3rd", "#cd7c4b", "#fff7ed"),
        ]
        podium_cards_html = ""
        for pi, row in enumerate(report.summary_matrix[:3]):
            lbl, color, bg = _pod_meta[pi]
            podium_cards_html += (
                f"<div class='pod-card' style='border-top:3px solid {color};background:{bg}'>"
                f"<span class='pod-rank' style='color:{color}'>{escape(lbl)}</span>"
                f"<div class='pod-name'>{escape(row.candidate_name)}</div>"
                f"<div class='pod-score' style='color:{color}'>{escape(row.final_global_score or '\u2014')}</div>"
                f"<div class='pod-score-lbl'>Global Score</div>"
                f"<div class='pod-meta'>"
                f"Judge: <strong>{escape(row.judge_score or '\u2014')}</strong>"
                f" &nbsp;&middot;&nbsp; Quality: <strong>{escape(row.quality_score or '\u2014')}</strong>"
                f"</div>"
                f"</div>"
            )

        summary_rows = ""
        for i, row in enumerate(report.summary_matrix):
            score = Decimal(row.final_global_score or "0")
            delta = score - best_score
            delta_str = "\u2014" if i == 0 else f"{delta:+.2f}"
            cost_raw = f"${row.total_estimated_cost}" if row.total_estimated_cost else "\u2014"
            latency_raw = f"{row.avg_duration_ms} ms" if row.avg_duration_ms is not None else "\u2014"
            winner = i == 0
            _rbs = [
                "<span class='rb rb-gold'>1</span>",
                "<span class='rb rb-silver'>2</span>",
                "<span class='rb rb-bronze'>3</span>",
            ]
            rb = _rbs[i] if i < 3 else f"<span class='rb rb-plain'>{i + 1}</span>"
            is_best_cost = best_cost is not None and row.total_estimated_cost and float(row.total_estimated_cost) == best_cost
            is_best_latency = best_latency is not None and row.avg_duration_ms is not None and row.avg_duration_ms == best_latency
            cost_td = f"<td class='best-col'>{escape(cost_raw)}</td>" if is_best_cost else f"<td>{escape(cost_raw)}</td>"
            lat_td = f"<td class='best-col'>{escape(latency_raw)}</td>" if is_best_latency else f"<td>{escape(latency_raw)}</td>"
            delta_cls = "delta-zero" if i == 0 else "delta-neg"
            summary_rows += (
                f"<tr{'  class=\"winner-row\"' if winner else ''}>"
                f"<td><div class='cand-cell'>{rb}<strong>{escape(row.candidate_name)}</strong></div></td>"
                f"<td>{_score_bar_html(row.judge_score)}</td>"
                f"<td>{_score_bar_html(row.quality_score)}</td>"
                f"{cost_td}"
                f"{lat_td}"
                f"<td>{_score_bar_html(row.final_global_score)}</td>"
                f"<td class='{delta_cls}'>{escape(delta_str)}</td>"
                "</tr>"
            )

        candidate_sections_html = ""
        for ci, section in enumerate(report.candidate_sections):
            color = _CHART_PALETTE[ci % len(_CHART_PALETTE)]
            cost_raw = f"${section.total_estimated_cost}" if section.total_estimated_cost else "\u2014"
            latency_raw = f"{section.avg_duration_ms} ms" if section.avg_duration_ms is not None else "\u2014"
            tps_raw = f"{section.avg_tokens_per_second} tok/s" if section.avg_tokens_per_second else "\u2014"
            global_score = section.final_global_score or "\u2014"
            dims_html = "".join([
                _dim_bar(section.average_relevance_score, "Relevance"),
                _dim_bar(section.average_accuracy_score, "Accuracy"),
                _dim_bar(section.average_completeness_score, "Completeness"),
                _dim_bar(section.average_clarity_score, "Clarity"),
                _dim_bar(section.average_instruction_following_score, "Instr. Following"),
            ])
            candidate_sections_html += (
                f"<div class='cand-card'>"
                f"<div class='cand-hdr' style='border-left:4px solid {color}'>"
                f"<div>"
                f"<h3 class='cand-name'>{escape(section.candidate_name)}</h3>"
                f"<p class='cand-meta'>{escape(section.provider_type)} &nbsp;&middot;&nbsp; {escape(section.runtime_type)}</p>"
                f"</div>"
                f"<div class='cand-global-score'>"
                f"<span class='cgs-num' style='color:{_sc(section.final_global_score)}'>{escape(global_score)}</span>"
                f"<span class='cgs-lbl'>&thinsp;/ 100</span>"
                f"</div>"
                f"</div>"
                f"<div class='cand-body'>"
                f"<div class='metric-grid'>"
                f"<div class='metric-box'><span class='mv'>{escape(latency_raw)}</span><span class='ml'>Avg Latency</span></div>"
                f"<div class='metric-box'><span class='mv'>{escape(tps_raw)}</span><span class='ml'>Throughput</span></div>"
                f"<div class='metric-box'><span class='mv'>{escape(cost_raw)}</span><span class='ml'>Total Cost</span></div>"
                f"<div class='metric-box'><span class='mv' style='color:{_sc(section.average_overall_score)}'>{escape(section.average_overall_score or '\u2014')}</span><span class='ml'>Avg Quality</span></div>"
                f"</div>"
                f"<div class='dims-block'>"
                f"<p class='dims-title'>Score Dimensions</p>"
                f"{dims_html}"
                f"</div>"
                f"<div class='patterns-grid'>"
                f"<div class='pblock pblock-green'><strong>Strengths</strong><p>{escape(section.best_patterns_text or '\u2014')}</p></div>"
                f"<div class='pblock pblock-red'><strong>Weaknesses</strong><p>{escape(section.weak_patterns_text or '\u2014')}</p></div>"
                f"</div>"
                f"<p class='cand-summary-text'>{escape(section.global_summary_text or 'No summary available.')}</p>"
                f"</div>"
                f"</div>"
            )

        prompt_sections_html = ""
        for pi, section in enumerate(report.prompt_sections):
            cmp_rows = ""
            for c in sorted(section.candidates, key=lambda x: int(x.ranking_in_batch or 999)):
                try:
                    q_per_tok = (
                        f"{float(c.overall_score) / c.total_tokens * 100:.2f}"
                        if c.overall_score and c.total_tokens
                        else "\u2014"
                    )
                except (ZeroDivisionError, ValueError):
                    q_per_tok = "\u2014"
                cmp_rows += (
                    f"<tr>"
                    f"<td>{escape(c.candidate_name)}</td>"
                    f"<td><strong style='color:{_sc(c.overall_score)}'>{escape(c.overall_score or '\u2014')}</strong></td>"
                    f"<td>#{escape(str(c.ranking_in_batch or '\u2014'))}</td>"
                    f"<td>{escape(str(c.duration_ms) + ' ms' if c.duration_ms else '\u2014')}</td>"
                    f"<td>{escape(str(c.total_tokens) if c.total_tokens else '\u2014')}</td>"
                    f"<td>{escape('$' + c.estimated_cost if c.estimated_cost else '\u2014')}</td>"
                    f"<td>{escape(q_per_tok)}</td>"
                    "</tr>"
                )
            sys_pre = (
                f"<p class='prompt-label'>System Prompt</p><pre class='pre-sys'>{escape(section.system_prompt_text)}</pre>"
                if section.system_prompt_text
                else ""
            )
            eval_note = (
                f"<div class='eval-note'><strong>Evaluation criteria:</strong> {escape(section.evaluation_notes)}</div>"
                if section.evaluation_notes
                else ""
            )
            meta_badges = "".join(
                f"<span class='badge'>{escape(value)}</span>"
                for value in [
                    section.category_name,
                    section.scenario_type,
                    f"cost {section.cost_tier}" if section.cost_tier else None,
                    f"weight {section.weight}" if section.weight else None,
                    f"v{section.version}" if section.version else None,
                ]
                if value
            )
            scenario_context = self._render_report_scenario_context(section)
            resp_html = ""
            for c in section.candidates:
                s_html = f"<p class='resp-s'><strong>Strengths:</strong> {escape(c.strengths_text)}</p>" if c.strengths_text else ""
                w_html = f"<p class='resp-w'><strong>Weaknesses:</strong> {escape(c.weaknesses_text)}</p>" if c.weaknesses_text else ""
                scores_html = (
                    f"<pre class='criterion-pre'>{escape(json.dumps(c.detailed_scores_jsonb, indent=2, ensure_ascii=False))}</pre>"
                    if c.detailed_scores_jsonb
                    else ""
                )
                resp_html += (
                    f"<div class='resp-card'>"
                    f"<div class='resp-card-hdr'>"
                    f"<h4>{escape(c.candidate_name)}</h4>"
                    f"<span class='resp-score-badge' style='background:{_sc(c.overall_score)}22;color:{_sc(c.overall_score)};border-color:{_sc(c.overall_score)}44'>"
                    f"{escape(c.overall_score or '\u2014')}</span>"
                    f"</div>"
                    f"<pre class='resp-pre'>{escape(c.normalized_response_text or 'No response')}</pre>"
                    f"{s_html}{w_html}"
                    f"{scores_html}"
                    f"<p class='resp-feedback'>{escape(c.detailed_feedback or 'No detailed feedback')}</p>"
                    f"</div>"
                )
            best_in_prompt = max(
                (float(c.overall_score) for c in section.candidates if c.overall_score),
                default=None,
            )
            top_score_html = (
                f"<span class='prompt-top-score' style='color:{_sc(str(best_in_prompt))}'>{best_in_prompt:.1f}</span>"
                if best_in_prompt is not None
                else ""
            )
            prompt_sections_html += (
                f"<div class='prompt-card' id='p{pi}'>"
                f"<div class='prompt-hdr' onclick='tp(this)'>"
                f"<div class='prompt-hdr-l'>"
                f"<span class='prompt-num'>#{pi + 1}</span>"
                f"<div>"
                f"<div class='prompt-title'>{escape(section.prompt_name)}</div>"
                f"<div class='badge-row'>{meta_badges}</div>"
                f"</div>"
                f"</div>"
                f"<div class='prompt-hdr-r'>{top_score_html}<span class='chevron'>&#x25BE;</span></div>"
                f"</div>"
                f"<div class='prompt-body'>"
                f"{sys_pre}"
                f"<p class='prompt-label'>User Prompt</p>"
                f"<pre class='pre-user'>{escape(section.user_prompt_text)}</pre>"
                f"{eval_note}"
                f"{scenario_context}"
                f"<div class='tbl-wrap'>"
                f"<table class='comparison'>"
                f"<thead><tr><th>Candidate</th><th>Score</th><th>Rank</th><th>Latency</th>"
                f"<th>Tokens</th><th>Cost</th><th title='Quality points per 100 tokens'>Qual/100 tok</th></tr></thead>"
                f"<tbody>{cmp_rows}</tbody>"
                f"</table>"
                f"</div>"
                f"<div class='resp-grid'>{resp_html}</div>"
                f"</div>"
                f"</div>"
            )

        launched_str = escape(report.launched_at.strftime("%B %d, %Y · %H:%M UTC"))

        _judge_names = [j.strip() for j in report.judge_name.split(" · ") if j.strip()]
        judges_kpi_html = "".join(
            f"<div class='judge-item'>"
            f"<svg class='judge-icon' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>"
            f"<path d='M8 1v14M4 5l4-4 4 4M3 12h10' stroke='#3b82f6' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/>"
            f"</svg>"
            f"<span>{escape(j)}</span>"
            f"</div>"
            for j in _judge_names
        )
        judges_label = "Judges" if len(_judge_names) > 1 else "Judge"

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{escape(report.report_title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"/>
  <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
  <style>
    :root {{
      --ink:#0f172a; --ink-s:#334155; --muted:#64748b; --muted-l:#94a3b8;
      --line:#e2e8f0; --line-l:#f1f5f9; --panel:#f8fafc; --white:#fff;
      --page:#f1f5f9; --primary:#3b82f6; --primary-s:#eff6ff; --primary-b:#bfdbfe;
      --ok:#10b981; --ok-s:#dcfce7; --warn:#f59e0b; --warn-s:#fefce8;
      --bad:#ef4444; --bad-s:#fee2e2; --gold:#eab308;
      --r:12px; --rs:8px; --rx:4px;
      --sh:0 1px 3px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.04);
      --sh-md:0 4px 12px rgba(15,23,42,.08),0 2px 4px rgba(15,23,42,.04);
      --sh-lg:0 10px 28px rgba(15,23,42,.10),0 4px 10px rgba(15,23,42,.05);
    }}
    *{{box-sizing:border-box;margin:0;padding:0}}
    html{{scroll-behavior:smooth}}
    body{{font-family:'Manrope',system-ui,sans-serif;color:var(--ink);background:var(--page);line-height:1.65;font-size:14px}}
    a{{color:var(--primary);text-decoration:none}}
    /* ── Nav ── */
    .nav{{
      position:sticky;top:0;z-index:200;background:#0f172a;
      border-bottom:1px solid rgba(255,255,255,.07);padding:0 32px;
      display:flex;align-items:center;gap:4px;box-shadow:0 2px 12px rgba(0,0,0,.25);
    }}
    .nav-brand{{
      font-family:'Space Grotesk',sans-serif;font-size:.95rem;font-weight:700;color:#f1f5f9;
      padding:13px 20px 13px 0;margin-right:4px;border-right:1px solid rgba(255,255,255,.1);white-space:nowrap;
    }}
    .nav-brand em{{color:#3b82f6;font-style:normal}}
    .nav a{{color:#64748b;font-size:.78rem;font-weight:500;padding:13px 12px;transition:color .15s;white-space:nowrap}}
    .nav a:hover{{color:#e2e8f0}}
    .nav-end{{margin-left:auto;color:#475569;font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px}}
    /* ── Layout ── */
    .wrap{{max-width:1160px;margin:0 auto;padding:28px 20px 72px}}
    /* ── Hero ── */
    .hero{{
      background:linear-gradient(135deg,#1e293b 0%,#0f172a 55%,#162032 100%);
      border-radius:var(--r);padding:36px 40px 32px;margin-bottom:24px;
      box-shadow:var(--sh-lg);position:relative;overflow:hidden;
    }}
    .hero::after{{
      content:'';position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse 70% 80% at 80% 40%,rgba(59,130,246,.14) 0%,transparent 65%);
    }}
    .hero-inner{{position:relative;z-index:1}}
    .hero h1{{
      font-family:'Space Grotesk',sans-serif;font-size:1.85rem;font-weight:700;
      color:#f1f5f9;letter-spacing:-.03em;margin-bottom:4px;
    }}
    .hero-sub{{color:#475569;font-size:.88rem;margin-bottom:22px}}
    .hero-kpis{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}}
    .kpi{{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);border-radius:var(--rs);padding:14px 16px}}
    .kpi strong{{display:block;font-size:.62rem;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.09em;margin-bottom:6px}}
    .kpi span{{color:#e2e8f0;font-weight:600;font-size:.92rem}}
    .judge-list{{display:flex;flex-direction:column;gap:6px;margin-top:2px}}
    .judge-item{{display:flex;align-items:center;gap:7px;color:#e2e8f0;font-weight:600;font-size:.88rem;line-height:1.2}}
    .judge-icon{{width:14px;height:14px;flex-shrink:0;opacity:.8}}
    /* ── Section card ── */
    .card{{background:var(--white);border-radius:var(--r);box-shadow:var(--sh-md);margin-bottom:22px;overflow:hidden}}
    .card-hdr{{padding:18px 26px 16px;border-bottom:1px solid var(--line-l);display:flex;align-items:baseline;gap:12px}}
    .card-hdr h2{{
      font-family:'Space Grotesk',sans-serif;font-size:.68rem;font-weight:700;
      text-transform:uppercase;letter-spacing:.1em;color:var(--muted);
    }}
    .card-body{{padding:20px 26px 24px}}
    /* ── Bias notice ── */
    .bias-notice{{
      background:#fffbeb;border:1px solid #fde68a;border-left:4px solid var(--warn);
      padding:12px 16px;border-radius:var(--rs);font-size:.875rem;margin-bottom:8px;
    }}
    /* ── Podium ── */
    .podium{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:22px}}
    .pod-card{{border-radius:var(--rs);padding:16px 18px;border:1px solid var(--line);box-shadow:var(--sh)}}
    .pod-rank{{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}}
    .pod-name{{font-size:.92rem;font-weight:700;color:var(--ink);margin-bottom:6px;line-height:1.3}}
    .pod-score{{font-family:'Space Grotesk',sans-serif;font-size:2.4rem;font-weight:700;line-height:1;margin-bottom:1px}}
    .pod-score-lbl{{font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}}
    .pod-meta{{font-size:.75rem;color:var(--muted)}}
    /* ── Weighting legend ── */
    .wt-legend{{
      display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:10px 14px;
      background:var(--primary-s);border-radius:var(--rs);border:1px solid var(--primary-b);
      font-size:.8rem;color:var(--ink-s);margin-bottom:16px;
    }}
    .wt-pill{{background:var(--primary);color:#fff;font-weight:700;font-size:.72rem;padding:2px 8px;border-radius:20px}}
    /* ── Tables ── */
    .tbl-wrap{{overflow-x:auto}}
    table{{width:100%;border-collapse:collapse;font-size:.875rem;background:var(--white)}}
    th{{
      background:var(--panel);padding:9px 14px;text-align:left;font-size:.65rem;
      font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
      border-bottom:2px solid var(--line);white-space:nowrap;
    }}
    td{{padding:9px 14px;border-bottom:1px solid var(--line-l)}}
    tr:last-child td{{border-bottom:none}}
    tbody tr:hover td{{background:#fafbfc}}
    .winner-row td{{background:var(--warn-s)!important}}
    .winner-row td:first-child{{border-left:3px solid var(--gold);padding-left:11px}}
    .best-col{{background:var(--ok-s)!important;color:#15803d;font-weight:700}}
    .category-table{{table-layout:fixed;font-size:.76rem}}
    .category-table th,.category-table td{{padding:7px 8px;text-align:center;vertical-align:middle}}
    .category-table th{{
      white-space:normal;line-height:1.15;font-size:.54rem;letter-spacing:.045em;
      word-break:normal;overflow-wrap:normal;hyphens:none;
    }}
    .category-table .cat-model-col{{width:104px;text-align:left}}
    .category-table .cat-model-cell{{
      width:104px;text-align:left;line-height:1.25;font-size:.74rem;word-break:normal;
    }}
    .category-table .best-col{{box-shadow:inset 0 0 0 999px rgba(34,197,94,.09)}}
    .delta-zero{{color:var(--muted)}}
    .delta-neg{{color:#dc2626;font-weight:600}}
    .rb{{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-size:.65rem;font-weight:700;flex-shrink:0}}
    .rb-gold{{background:#fefce8;color:#92400e;border:1px solid #fde68a}}
    .rb-silver{{background:var(--panel);color:#64748b;border:1px solid #cbd5e1}}
    .rb-bronze{{background:#fff7ed;color:#9a3412;border:1px solid #fdba74}}
    .rb-plain{{background:var(--panel);color:var(--muted);border:1px solid var(--line)}}
    .cand-cell{{display:flex;align-items:center;gap:8px}}
    .sb{{display:flex;align-items:center;gap:8px;min-width:90px}}
    .sb-track{{flex:1;height:5px;background:var(--line);border-radius:3px;overflow:hidden}}
    .sb-fill{{height:100%;border-radius:3px}}
    .sb-num{{font-weight:700;font-size:.8rem;min-width:3.2ch;text-align:right}}
    /* ── Charts ── */
    .chart-full{{margin-bottom:16px}}
    .charts-3{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}}
    .chart-box{{border:1px solid var(--line);border-radius:var(--rs);padding:16px 18px;background:var(--panel)}}
    .chart-box h3{{font-size:.85rem;font-weight:600;color:var(--ink-s);margin-bottom:2px}}
    .chart-desc{{font-size:.72rem;color:var(--muted);margin-bottom:8px}}
    /* ── Candidate cards ── */
    .cand-grid{{display:grid;gap:16px}}
    .cand-card{{border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--white);box-shadow:var(--sh)}}
    .cand-hdr{{
      padding:18px 22px;display:flex;justify-content:space-between;align-items:center;
      background:var(--panel);border-bottom:1px solid var(--line);
    }}
    .cand-name{{font-size:1rem;font-weight:700;margin-bottom:3px}}
    .cand-meta{{font-size:.78rem;color:var(--muted)}}
    .cand-global-score{{text-align:right;padding-left:16px}}
    .cgs-num{{font-family:'Space Grotesk',sans-serif;font-size:2.1rem;font-weight:700;line-height:1}}
    .cgs-lbl{{font-size:.68rem;color:var(--muted)}}
    .cand-body{{padding:18px 22px}}
    .metric-grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}}
    .metric-box{{background:var(--panel);border:1px solid var(--line);border-radius:var(--rs);padding:12px 14px;text-align:center}}
    .mv{{display:block;font-family:'Space Grotesk',sans-serif;font-size:.95rem;font-weight:700;color:var(--primary);margin-bottom:3px}}
    .ml{{display:block;font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:600}}
    .dims-block{{margin-bottom:16px}}
    .dims-title{{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:10px}}
    .dim-row{{display:flex;align-items:center;gap:10px;margin-bottom:7px}}
    .dim-lbl{{font-size:.78rem;color:var(--ink-s);width:130px;flex-shrink:0;font-weight:500}}
    .dim-track{{flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden}}
    .dim-fill{{height:100%;border-radius:3px}}
    .dim-val{{font-size:.78rem;font-weight:700;min-width:3ch;text-align:right}}
    .patterns-grid{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}}
    .pblock{{padding:12px 14px;border-radius:var(--rs);font-size:.875rem}}
    .pblock strong{{display:block;font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-s);margin-bottom:6px}}
    .pblock p{{color:var(--ink-s);line-height:1.55}}
    .pblock-green{{background:var(--ok-s);border-left:3px solid var(--ok)}}
    .pblock-red{{background:var(--bad-s);border-left:3px solid var(--bad)}}
    .cand-summary-text{{font-size:.85rem;color:var(--muted);margin-top:6px;line-height:1.6}}
    /* ── Prompt cards ── */
    .prompt-card{{border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--white);box-shadow:var(--sh);margin-bottom:10px}}
    .prompt-hdr{{
      padding:14px 20px;display:flex;justify-content:space-between;align-items:center;
      cursor:pointer;user-select:none;background:var(--white);transition:background .15s;
    }}
    .prompt-hdr:hover{{background:var(--panel)}}
    .prompt-hdr-l{{display:flex;align-items:flex-start;gap:12px}}
    .prompt-num{{
      font-size:.68rem;font-weight:700;color:var(--muted-l);font-family:'Space Grotesk',sans-serif;
      background:var(--panel);border:1px solid var(--line);border-radius:var(--rx);
      padding:3px 7px;flex-shrink:0;margin-top:1px;
    }}
    .prompt-title{{font-size:.88rem;font-weight:600;color:var(--ink);margin-bottom:3px}}
    .badge{{
      display:inline-block;background:var(--primary-s);color:#0369a1;font-size:.7rem;
      font-weight:600;padding:2px 8px;border-radius:20px;border:1px solid var(--primary-b);
    }}
    .badge-row{{display:flex;flex-wrap:wrap;gap:5px}}
    .prompt-hdr-r{{display:flex;align-items:center;gap:10px}}
    .prompt-top-score{{font-family:'Space Grotesk',sans-serif;font-size:.95rem;font-weight:700}}
    .chevron{{font-size:.75rem;color:var(--muted-l);transition:transform .2s;display:inline-block}}
    .prompt-card.open .chevron{{transform:rotate(180deg)}}
    .prompt-body{{display:none;border-top:1px solid var(--line-l);padding:18px 20px}}
    .prompt-card.open .prompt-body{{display:block}}
    .prompt-label{{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px;margin-top:2px}}
    pre{{
      white-space:pre-wrap;word-break:break-word;background:var(--panel);border:1px solid var(--line);
      padding:11px 14px;border-radius:var(--rs);font-size:.8rem;margin-bottom:12px;
      font-family:'Cascadia Code','Fira Code',Consolas,monospace;line-height:1.5;
    }}
    .pre-sys{{background:#fffbeb;border-color:#fde68a}}
    .eval-note{{
      font-size:.83rem;color:var(--ink-s);margin-bottom:12px;padding:8px 12px;
      background:var(--panel);border-radius:var(--rs);border-left:3px solid var(--primary);
    }}
    .scenario-context{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}}
    .scenario-block{{border:1px solid var(--line);background:var(--panel);border-radius:var(--rs);padding:10px 12px}}
    .scenario-block strong{{display:block;font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}}
    .scenario-block p{{font-size:.82rem;color:var(--ink-s);line-height:1.5}}
    .scenario-block pre,.criterion-pre{{font-size:.72rem;max-height:220px;overflow:auto;background:var(--white)}}
    .resp-grid{{display:grid;gap:10px;margin-top:4px}}
    .resp-card{{border:1px solid var(--line);border-radius:var(--rs);overflow:hidden}}
    .resp-card-hdr{{
      padding:9px 14px;background:var(--panel);border-bottom:1px solid var(--line);
      display:flex;justify-content:space-between;align-items:center;
    }}
    .resp-card-hdr h4{{font-size:.85rem;font-weight:600;color:var(--primary)}}
    .resp-score-badge{{font-size:.75rem;font-weight:700;padding:2px 9px;border-radius:20px;border:1px solid transparent}}
    .resp-pre{{margin:0;border:none;border-radius:0;border-bottom:1px solid var(--line-l);background:var(--white)}}
    .resp-s,.resp-w{{font-size:.83rem;margin:8px 14px;padding:6px 10px;border-radius:var(--rx);border-left:3px solid}}
    .resp-s{{background:var(--ok-s);border-color:var(--ok)}}
    .resp-w{{background:var(--bad-s);border-color:var(--bad)}}
    .resp-feedback{{font-size:.8rem;color:var(--muted);padding:8px 14px 12px}}
    .expand-btn{{
      font-size:.72rem;font-weight:600;color:var(--primary);border:1px solid var(--primary-b);
      background:var(--primary-s);padding:4px 12px;border-radius:20px;cursor:pointer;margin-left:auto;
    }}
    .expand-btn:hover{{background:var(--primary-b)}}
    .page-foot{{text-align:center;padding:18px;color:var(--muted-l);font-size:.75rem;border-top:1px solid var(--line);margin-top:4px}}
    /* ── Print ── */
    @media print {{
      body{{background:#fff;font-size:12px}}
      .nav{{display:none}}
      .wrap{{padding:0;max-width:100%}}
      .hero{{border-radius:0;box-shadow:none;padding:24px 28px}}
      .card{{box-shadow:none;margin-bottom:14px}}
      .prompt-card{{page-break-inside:avoid}}
      .prompt-body{{display:block!important}}
      .chevron,.expand-btn{{display:none}}
      .cand-card{{page-break-inside:avoid}}
      .charts-3{{grid-template-columns:1fr}}
    }}
  </style>
</head>
<body>
  <nav class="nav">
    <div class="nav-brand"><em>Bench</em>Forge</div>
    <a href="#summary">Summary</a>
    <a href="#charts">Charts</a>
    <a href="#candidates">Candidates</a>
    <a href="#prompts">Prompts</a>
    <div class="nav-end">{escape(report.report_title)}</div>
  </nav>
  <div class="wrap">
    <header class="hero">
      <div class="hero-inner">
        <h1>{escape(report.report_title)}</h1>
        <p class="hero-sub">{escape(report.benchmark_session_name)}</p>
        <div class="hero-kpis">
          <div class="kpi"><strong>Run Timestamp</strong><span>{launched_str}</span></div>
          <div class="kpi"><strong>{judges_label}</strong><div class="judge-list">{judges_kpi_html}</div></div>
          <div class="kpi"><strong>Prompts</strong><span>{report.prompt_count}</span></div>
          <div class="kpi"><strong>Candidates</strong><span>{report.candidate_count}</span></div>
        </div>
      </div>
    </header>
    {judge_bias_html}
    <section class="card" id="summary">
      <div class="card-hdr"><h2>Executive Summary</h2></div>
      <div class="card-body">
        {f'<div class="podium">{podium_cards_html}</div>' if podium_cards_html else ''}
        <div class="wt-legend">
          <strong>Score formula:</strong>
          <span class="wt-pill">{_QUALITY_WEIGHT_PCT}%</span> Judge Score
          <span style="color:var(--muted)">+</span>
          <span class="wt-pill">{_COST_WEIGHT_PCT}%</span> Cost Score
          <span style="color:var(--muted)">+</span>
          <span class="wt-pill">{_PERFORMANCE_WEIGHT_PCT}%</span> Performance Score
        </div>
        <div class="tbl-wrap">
          <table>
            <thead><tr>
              <th>Candidate</th><th>Judge Score</th><th>Quality Score</th>
              <th>Total Cost</th><th>Avg Latency</th><th>Global Score</th><th>&#916; vs Leader</th>
            </tr></thead>
            <tbody>{summary_rows}</tbody>
          </table>
        </div>
        {f'<h3 style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin:22px 0 8px">Score by Category</h3>{category_html}' if category_html else ''}
      </div>
    </section>
    <section class="card" id="charts">
      <div class="card-hdr"><h2>Visual Analysis</h2></div>
      <div class="card-body">
        <div class="chart-full">
          <div class="chart-box">
            <h3>Score Comparison &mdash; All Models</h3>
            <p class="chart-desc">Global, Judge and Quality scores for every candidate at a glance.</p>
            {bar_chart_plotly}
          </div>
        </div>
        <div class="charts-3">
          <div class="chart-box">
            <h3>Sub-Score Radar</h3>
            <p class="chart-desc">Dimension-level averages &mdash; the personality of each model.</p>
            {radar_plotly}
          </div>
          <div class="chart-box">
            <h3>Efficiency Frontier</h3>
            <p class="chart-desc">Upper-left ideal: high quality at low latency.</p>
            {scatter_plotly}
          </div>
          <div class="chart-box">
            <h3>Category Radar</h3>
            <p class="chart-desc">Average judge score per prompt category.</p>
            {category_radar_plotly}
          </div>
        </div>
      </div>
    </section>
    <section class="card" id="candidates">
      <div class="card-hdr"><h2>Candidate Analysis</h2></div>
      <div class="card-body">
        <div class="cand-grid">{candidate_sections_html}</div>
      </div>
    </section>
    <section class="card" id="prompts">
      <div class="card-hdr">
        <h2>Prompt Details</h2>
        <button class="expand-btn" onclick="expandAll()">Expand All</button>
      </div>
      <div class="card-body" style="padding-top:12px">
        {prompt_sections_html}
      </div>
    </section>
    <footer class="page-foot">
      Generated by <strong>BenchForge</strong> &mdash; Open-source LLM Benchmarking &nbsp;&middot;&nbsp; {launched_str}
    </footer>
  </div>
  <script>
    function tp(h) {{ h.closest('.prompt-card').classList.toggle('open'); }}
    function expandAll() {{ document.querySelectorAll('.prompt-card').forEach(c => c.classList.add('open')); }}
  </script>
</body>
</html>"""

    async def _render_pdf(self, html: str, output_path: Path) -> None:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            try:
                page = await browser.new_page()
                await page.set_content(html, wait_until="domcontentloaded", timeout=15_000)
                try:
                    await page.wait_for_function(
                        "() => document.querySelectorAll('.js-plotly-plot .main-svg').length > 0",
                        timeout=5_000,
                    )
                except Exception:
                    pass
                await page.pdf(
                    path=str(output_path),
                    format="A4",
                    print_background=True,
                    margin={
                        "top": "15mm",
                        "bottom": "15mm",
                        "left": "15mm",
                        "right": "15mm",
                    },
                    timeout=15_000,
                )
            finally:
                await browser.close()

    # ── Plotly charts ──────────────────────────────────────────────────────

    def _render_radar_plotly(self, report: RunReportRead) -> str:
        dims = ["Relevance", "Accuracy", "Completeness", "Clarity", "Instr. Following"]
        fig = go.Figure()

        for ci, section in enumerate(report.candidate_sections):
            color = _CHART_PALETTE[ci % len(_CHART_PALETTE)]
            vals = [
                float(section.average_relevance_score or "0"),
                float(section.average_accuracy_score or "0"),
                float(section.average_completeness_score or "0"),
                float(section.average_clarity_score or "0"),
                float(section.average_instruction_following_score or "0"),
            ]
            fig.add_trace(go.Scatterpolar(
                r=vals + [vals[0]],
                theta=dims + [dims[0]],
                fill="toself",
                fillcolor=_hex_rgba(color, 0.12),
                line=dict(color=color, width=2.5),
                name=section.candidate_name,
                hovertemplate="<b>%{theta}</b><br>Score: %{r:.1f}<extra>%{fullData.name}</extra>",
            ))

        fig.update_layout(
            polar=dict(
                radialaxis=dict(
                    range=[0, 100],
                    tickfont=dict(size=9, color="#94a3b8", family="Manrope, sans-serif"),
                    gridcolor="#e2e8f0",
                    linecolor="#e2e8f0",
                    tickmode="linear",
                    tick0=0,
                    dtick=25,
                ),
                angularaxis=dict(
                    tickfont=dict(size=10.5, color="#475569", family="Manrope, sans-serif"),
                    gridcolor="#e2e8f0",
                    linecolor="#cbd5e1",
                ),
                bgcolor="rgba(0,0,0,0)",
            ),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            legend=dict(
                font=dict(family="Manrope, sans-serif", size=10, color="#334155"),
                bgcolor="rgba(255,255,255,0.92)",
                bordercolor="#e2e8f0",
                borderwidth=1,
                orientation="h",
                yanchor="top",
                y=-0.08,
                xanchor="center",
                x=0.5,
            ),
            margin=dict(l=20, r=20, t=10, b=70),
            height=360,
            font=dict(family="Manrope, system-ui, sans-serif", color="#334155"),
        )

        return pio.to_html(
            fig,
            full_html=False,
            include_plotlyjs=False,
            config={"responsive": True, "displayModeBar": False},
        )

    @staticmethod
    def _scatter_label_offsets(
        coords: list[tuple[float, float]],
    ) -> list[tuple[float, float]]:
        """Return (ax, ay) Plotly annotation offsets with iterative repulsion."""
        n = len(coords)
        if n == 0:
            return []

        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        x_lo, x_hi = min(xs), max(xs)
        y_lo, y_hi = min(ys), max(ys)
        xspan = x_hi - x_lo or 1.0
        yspan = y_hi - y_lo or 1.0

        # Map data coords → screen pixels (y-axis flipped: high quality = top = low screen-y)
        # Chart drawing area: height=370, margins t=20 b=80 l=55 r=20 → ~700×270 px
        CW, CH = 700.0, 270.0

        def to_px(x: float, y: float) -> tuple[float, float]:
            return (x - x_lo) / xspan * CW, (1.0 - (y - y_lo) / yspan) * CH

        pts = [to_px(x, y) for x, y in coords]
        cx = sum(p[0] for p in pts) / n
        cy = sum(p[1] for p in pts) / n

        # Initial offset: push each label away from the cluster centroid
        ring = [i * 2 * math.pi / n for i in range(n)]
        offs: list[list[float]] = []
        for i, (px, py) in enumerate(pts):
            dx, dy = px - cx, py - cy
            d = math.sqrt(dx * dx + dy * dy)
            if d < 15.0:
                a = ring[i]
                dx, dy, d = math.cos(a) * 20, math.sin(a) * 20, 20.0
            nx, ny = dx / d, dy / d
            offs.append([nx * 90.0, ny * 60.0])

        # Annotation bounding box (px) — generous estimate
        LW, LH = 168.0, 54.0

        # Iterative repulsion: push overlapping labels apart
        for _ in range(150):
            moved = False
            for i in range(n):
                for j in range(i + 1, n):
                    li_x = pts[i][0] + offs[i][0]
                    li_y = pts[i][1] + offs[i][1]
                    lj_x = pts[j][0] + offs[j][0]
                    lj_y = pts[j][1] + offs[j][1]
                    ov_x = LW - abs(li_x - lj_x)
                    ov_y = LH - abs(li_y - lj_y)
                    if ov_x > 0 and ov_y > 0:
                        ddx, ddy = li_x - lj_x, li_y - lj_y
                        d2 = math.sqrt(ddx * ddx + ddy * ddy) or 1.0
                        push = min(ov_x, ov_y) * 0.65 + 10.0
                        offs[i][0] += ddx / d2 * push
                        offs[i][1] += ddy / d2 * push
                        offs[j][0] -= ddx / d2 * push
                        offs[j][1] -= ddy / d2 * push
                        moved = True
            if not moved:
                break

        # Keep labels inside chart: don't let them go above the top edge
        for i in range(n):
            if pts[i][1] + offs[i][1] < LH * 0.55:
                offs[i][1] = LH * 0.55 - pts[i][1]

        # Plotly ax/ay: positive ax = right, positive ay = DOWN (same as screen coords)
        return [(off[0], off[1]) for off in offs]

    def _render_scatter_plotly(self, report: RunReportRead) -> str:
        data = [
            (s.candidate_name, s.avg_duration_ms, float(s.average_overall_score or "0"))
            for s in report.candidate_sections
            if s.avg_duration_ms is not None
        ]
        if not data:
            return "<p class='muted'>No latency data available for efficiency chart.</p>"

        fig = go.Figure()
        for ci, (name, lat, qual) in enumerate(data):
            color = _CHART_PALETTE[ci % len(_CHART_PALETTE)]
            fig.add_trace(go.Scatter(
                x=[lat],
                y=[qual],
                mode="markers",
                marker=dict(size=16, color=color, line=dict(color="white", width=2.5), opacity=0.92),
                name=name,
                hovertemplate=(
                    f"<b>{escape(name)}</b><br>"
                    "Latency: %{x:,.0f} ms<br>"
                    "Quality: %{y:.1f}<extra></extra>"
                ),
            ))

        fig.update_layout(
            xaxis=dict(
                title=dict(text="Latency (ms) — lower is faster →", font=dict(size=11, family="Manrope, sans-serif", color="#64748b")),
                gridcolor="#f1f5f9",
                linecolor="#e2e8f0",
                tickfont=dict(size=9.5, color="#94a3b8", family="Manrope, sans-serif"),
                zeroline=False,
            ),
            yaxis=dict(
                title=dict(text="Quality score ↑", font=dict(size=11, family="Manrope, sans-serif", color="#64748b")),
                gridcolor="#f1f5f9",
                linecolor="#e2e8f0",
                tickfont=dict(size=9.5, color="#94a3b8", family="Manrope, sans-serif"),
                zeroline=False,
                range=[0, 100],
            ),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(248,250,252,0.6)",
            legend=dict(
                font=dict(family="Manrope, sans-serif", size=10, color="#334155"),
                bgcolor="rgba(255,255,255,0.92)",
                bordercolor="#e2e8f0",
                borderwidth=1,
                orientation="h",
                yanchor="top",
                y=-0.18,
                xanchor="center",
                x=0.5,
            ),
            showlegend=True,
            margin=dict(l=55, r=20, t=10, b=80),
            height=360,
            font=dict(family="Manrope, system-ui, sans-serif", color="#334155"),
        )

        return pio.to_html(
            fig,
            full_html=False,
            include_plotlyjs=False,
            config={"responsive": True, "displayModeBar": False},
        )

    def _render_bar_chart_plotly(self, report: RunReportRead) -> str:
        rows = report.summary_matrix
        if not rows:
            return "<p class='muted' style='padding:8px 0'>No data available.</p>"

        rev = list(reversed(rows))
        candidates = [r.candidate_name for r in rev]

        def _fv(attr: str) -> list[float]:
            return [float(getattr(r, attr) or "0") for r in rev]

        fig = go.Figure()
        for scores, name, color in [
            (_fv("final_global_score"), "Global Score", "#3b82f6"),
            (_fv("judge_score"), "Judge Score", "#10b981"),
            (_fv("quality_score"), "Quality Score", "#a855f7"),
        ]:
            fig.add_trace(go.Bar(
                y=candidates, x=scores, name=name,
                orientation="h", opacity=0.88,
                marker=dict(color=color, line_width=0),
                hovertemplate=f"<b>%{{y}}</b><br>{name}: %{{x:.2f}}<extra></extra>",
            ))

        n = len(candidates)
        height = max(220, 70 + n * 48)
        fig.update_layout(
            barmode="group",
            xaxis=dict(
                range=[0, 100], gridcolor="#f1f5f9", linecolor="#e2e8f0",
                tickfont=dict(size=9.5, color="#94a3b8", family="Manrope, sans-serif"),
                zeroline=False,
            ),
            yaxis=dict(
                tickfont=dict(size=10.5, color="#334155", family="Manrope, sans-serif"),
            ),
            legend=dict(
                font=dict(family="Manrope, sans-serif", size=10.5, color="#334155"),
                bgcolor="rgba(255,255,255,.9)", bordercolor="#e2e8f0", borderwidth=1,
                orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0,
            ),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            margin=dict(l=10, r=20, t=44, b=20),
            height=height,
            font=dict(family="Manrope, system-ui, sans-serif", color="#334155"),
        )
        return pio.to_html(
            fig,
            full_html=False,
            include_plotlyjs=False,
            config={"responsive": True, "displayModeBar": False},
        )


    def generate_summary_svg(self, report: RunReportRead) -> str:
        """Generate a 1200×630 LinkedIn-ready summary card SVG."""
        FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"
        W, H = 1200, 630
        COLORS = _CHART_PALETTE

        sorted_cands = sorted(
            report.candidate_sections,
            key=lambda s: float(s.final_global_score or "0"),
            reverse=True,
        )

        def _e(v: object) -> str:
            return escape(str(v))

        def _score_bar(x: int, y: int, w: int, h: int, score: float, color: str, bg: str = "#e2e8f0") -> str:
            fill = max(0, min(int(score / 100 * w), w))
            parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{bg}"/>']
            if fill > 2:
                parts.append(f'<rect x="{x}" y="{y}" width="{fill}" height="{h}" rx="4" fill="{color}"/>')
            return "".join(parts)

        lines: list[str] = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
            "<defs>",
            '  <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0">',
            '    <stop offset="0%" stop-color="#1e293b"/>',
            '    <stop offset="100%" stop-color="#0f172a"/>',
            "  </linearGradient>",
            '  <filter id="cs" x="-4%" y="-4%" width="108%" height="120%">',
            '    <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.10"/>',
            "  </filter>",
            "</defs>",
            # Background
            f'<rect width="{W}" height="{H}" fill="#f8fafc"/>',
            # Header
            f'<rect width="{W}" height="80" fill="url(#hdr)"/>',
            f'<text x="40" y="51" font-family="{FONT}" font-size="27" font-weight="800" fill="#3b82f6">Bench</text>',
            f'<text x="135" y="51" font-family="{FONT}" font-size="27" font-weight="800" fill="#f1f5f9">Forge</text>',
            f'<circle cx="214" cy="44" r="3" fill="#3b82f6"/>',
            f'<text x="228" y="51" font-family="{FONT}" font-size="16" font-weight="600" fill="#cbd5e1">{_e(report.report_title[:56])}</text>',
            f'<text x="{W - 40}" y="33" font-family="{FONT}" font-size="12" fill="#64748b" text-anchor="end">{_e(report.launched_at.strftime("%b %d, %Y"))}</text>',
            f'<text x="{W - 40}" y="51" font-family="{FONT}" font-size="12" fill="#64748b" text-anchor="end">Judge: {_e(report.judge_name)}</text>',
            f'<text x="{W - 40}" y="69" font-family="{FONT}" font-size="12" fill="#475569" text-anchor="end">{report.prompt_count} prompts · {report.candidate_count} models</text>',
            # Session name subtitle
            f'<text x="40" y="105" font-family="{FONT}" font-size="13" fill="#94a3b8">{_e(report.benchmark_session_name)}</text>',
        ]

        # ── Top-N cards ──
        top_n = min(3, len(sorted_cands))
        gap = 20
        card_w = (W - 80 - gap * (top_n - 1)) // top_n
        card_y = 118
        card_h = 262

        for i, cand in enumerate(sorted_cands[:top_n]):
            cx = 40 + i * (card_w + gap)
            color = COLORS[i % len(COLORS)]
            hdr_h = 58

            lines += [
                f'<rect x="{cx}" y="{card_y}" width="{card_w}" height="{card_h}" rx="12" fill="white" filter="url(#cs)"/>',
                f'<rect x="{cx}" y="{card_y}" width="{card_w}" height="{hdr_h}" rx="12" fill="{color}"/>',
                f'<rect x="{cx}" y="{card_y + hdr_h - 12}" width="{card_w}" height="12" fill="{color}"/>',
                # Rank badge
                f'<circle cx="{cx + card_w - 28}" cy="{card_y + 29}" r="17" fill="rgba(0,0,0,0.18)"/>',
                f'<text x="{cx + card_w - 28}" y="{card_y + 35}" font-family="{FONT}" font-size="14" font-weight="800" fill="white" text-anchor="middle">#{i + 1}</text>',
                # Model name
                f'<text x="{cx + 18}" y="{card_y + 38}" font-family="{FONT}" font-size="14" font-weight="700" fill="white">{_e(cand.candidate_name[:21])}</text>',
            ]

            global_score = cand.final_global_score or "—"
            quality = float(cand.average_overall_score or "0")
            latency = f"{cand.avg_duration_ms:,} ms" if cand.avg_duration_ms else "—"
            cost_raw = cand.total_estimated_cost
            cost = f"${float(cost_raw):.4f}" if cost_raw else "—"

            metrics = [
                ("Global Score", global_score, color),
                ("Quality", f"{quality:.1f} / 100", "#10b981"),
                ("Latency", latency, "#f97316"),
                ("Cost", cost, "#a855f7"),
            ]
            for j, (label, value, mc) in enumerate(metrics):
                my = card_y + hdr_h + 12 + j * 48
                lines += [
                    f'<text x="{cx + 18}" y="{my}" font-family="{FONT}" font-size="11" fill="#94a3b8">{_e(label)}</text>',
                    f'<text x="{cx + 18}" y="{my + 21}" font-family="{FONT}" font-size="16" font-weight="700" fill="{mc}">{_e(value)}</text>',
                ]

        # ── All-models quality bar chart ──
        bar_section_y = card_y + card_h + 18
        lines.append(
            f'<text x="40" y="{bar_section_y + 4}" font-family="{FONT}" font-size="12" font-weight="700"'
            f' fill="#475569" letter-spacing="0.8">ALL MODELS — QUALITY SCORE</text>'
        )

        label_w = 220
        bar_x0 = 40 + label_w
        bar_max_w = W - bar_x0 - 70
        bar_h_each, bar_gap = 16, 7
        show_n = min(len(sorted_cands), 8)
        bar_start_y = bar_section_y + 18

        for i, cand in enumerate(sorted_cands[:show_n]):
            color = COLORS[i % len(COLORS)]
            score = float(cand.average_overall_score or "0")
            by = bar_start_y + i * (bar_h_each + bar_gap)
            name = cand.candidate_name[:25] + ("…" if len(cand.candidate_name) > 25 else "")
            lines += [
                f'<text x="40" y="{by + 12}" font-family="{FONT}" font-size="11" fill="#475569">{_e(name)}</text>',
                _score_bar(bar_x0, by, bar_max_w, bar_h_each, score, color),
                f'<text x="{bar_x0 + bar_max_w + 10}" y="{by + 12}" font-family="{FONT}" font-size="12" font-weight="700" fill="{color}">{score:.1f}</text>',
            ]

        # ── Footer ──
        footer_y = H - 42
        lines += [
            f'<rect y="{footer_y}" width="{W}" height="42" fill="#1e293b"/>',
            f'<circle cx="44" cy="{footer_y + 21}" r="6" fill="#3b82f6"/>',
            f'<text x="58" y="{footer_y + 26}" font-family="{FONT}" font-size="13" font-weight="700" fill="#f1f5f9">BenchForge</text>',
            f'<text x="{W // 2}" y="{footer_y + 26}" font-family="{FONT}" font-size="12" fill="#64748b" text-anchor="middle">'
            "Open-source LLM benchmarking · github.com/alexis-soltysiak/BenchForge"
            "</text>",
        ]

        lines.append("</svg>")
        return "\n".join(lines)

    async def get_summary_svg(self, run_id: int) -> str:
        report = await self.get_report(run_id)
        return self.generate_summary_svg(report)

    def _render_category_radar_plotly(self, report: RunReportRead) -> str:
        by_cat: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        for section in report.prompt_sections:
            for c in section.candidates:
                if c.overall_score:
                    by_cat[section.category_name][c.candidate_name].append(float(c.overall_score))

        categories = sorted(by_cat)
        if len(categories) < 3:
            return "<p class='muted'>At least 3 categories are needed to render a radar chart.</p>"

        fig = go.Figure()

        for ci, section in enumerate(report.candidate_sections):
            color = _CHART_PALETTE[ci % len(_CHART_PALETTE)]
            vals = [
                sum(scores) / len(scores) if (scores := by_cat[cat].get(section.candidate_name, [])) else 0.0
                for cat in categories
            ]
            fig.add_trace(go.Scatterpolar(
                r=vals + [vals[0]],
                theta=categories + [categories[0]],
                fill="toself",
                fillcolor=_hex_rgba(color, 0.12),
                line=dict(color=color, width=2.5),
                name=section.candidate_name,
                hovertemplate="<b>%{theta}</b><br>Score: %{r:.1f}<extra>%{fullData.name}</extra>",
            ))

        fig.update_layout(
            polar=dict(
                radialaxis=dict(
                    range=[0, 100],
                    tickfont=dict(size=9, color="#94a3b8", family="Manrope, sans-serif"),
                    gridcolor="#e2e8f0",
                    linecolor="#e2e8f0",
                    tickmode="linear",
                    tick0=0,
                    dtick=25,
                ),
                angularaxis=dict(
                    tickfont=dict(size=10.5, color="#475569", family="Manrope, sans-serif"),
                    gridcolor="#e2e8f0",
                    linecolor="#cbd5e1",
                ),
                bgcolor="rgba(0,0,0,0)",
            ),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            legend=dict(
                font=dict(family="Manrope, sans-serif", size=10, color="#334155"),
                bgcolor="rgba(255,255,255,0.92)",
                bordercolor="#e2e8f0",
                borderwidth=1,
                orientation="h",
                yanchor="top",
                y=-0.08,
                xanchor="center",
                x=0.5,
            ),
            margin=dict(l=20, r=20, t=10, b=70),
            height=360,
            font=dict(family="Manrope, system-ui, sans-serif", color="#334155"),
        )

        return pio.to_html(
            fig,
            full_html=False,
            include_plotlyjs=False,
            config={"responsive": True, "displayModeBar": False},
        )

    def _render_category_breakdown_html(self, report: RunReportRead) -> str:
        by_cat: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        for section in report.prompt_sections:
            for c in section.candidates:
                if c.overall_score:
                    by_cat[section.category_name][c.candidate_name].append(float(c.overall_score))

        if not by_cat:
            return ""

        candidate_names = [s.candidate_name for s in report.candidate_sections]
        sorted_cats = sorted(by_cat)

        avgs_by_cat: dict[str, dict[str, float | None]] = {}
        for cat in sorted_cats:
            avgs_by_cat[cat] = {}
            for name in candidate_names:
                scores = by_cat[cat].get(name, [])
                avgs_by_cat[cat][name] = sum(scores) / len(scores) if scores else None

        headers = "<th class='cat-model-col'>Model</th>" + "".join(
            (
                f"<th title='{escape(cat)}'>"
                f"{escape(self._category_table_label(cat))}"
                "</th>"
            )
            for cat in sorted_cats
        )

        # Best score per column (category), not per row
        best_per_cat = {
            cat: max((avgs_by_cat[cat][n] for n in candidate_names if avgs_by_cat[cat][n] is not None), default=None)
            for cat in sorted_cats
        }

        rows = ""
        for name in candidate_names:
            rows += (
                "<tr>"
                f"<td class='cat-model-cell'><strong>{escape(name)}</strong></td>"
            )
            for cat in sorted_cats:
                val = avgs_by_cat[cat][name]
                if val is not None:
                    is_best = best_per_cat[cat] is not None and val == best_per_cat[cat]
                    rows += (
                        f"<td{'  class=\"best-col\"' if is_best else ''}>"
                        f"{val:.1f}"
                        "</td>"
                    )
                else:
                    rows += "<td>—</td>"
            rows += "</tr>"

        return (
            "<table class='comparison category-table'>"
            f"<thead><tr>{headers}</tr></thead>"
            f"<tbody>{rows}</tbody>"
            "</table>"
        )

    def _category_table_label(self, category: str) -> str:
        labels = {
            "code_debug": "Code Debug",
            "code_review": "Code Review",
            "creative_constrained": "Creative",
            "data_quality": "Data Quality",
            "document_synthesis": "Doc Synth",
            "product_reasoning": "Product",
            "professional_writing": "Pro Writing",
            "refactor_constrained": "Refactor",
            "sensitive_communication": "Sensitive",
        }
        normalized = category.lower().replace(" ", "_").replace("-", "_")
        return labels.get(normalized, category.replace("_", " ").title())

    def _judge_bias_notice(self, report: RunReportRead) -> str:
        judge_lower = report.judge_name.lower()
        matches = [
            s.candidate_name
            for s in report.candidate_sections
            if s.candidate_name.lower() in judge_lower or judge_lower in s.candidate_name.lower()
        ]
        if not matches:
            return ""
        names = ", ".join(escape(m) for m in matches)
        return (
            "<p class='bias-notice'>⚠ <strong>Potential judge bias:</strong> "
            f"The judge (<strong>{escape(report.judge_name)}</strong>) appears to share a model family "
            f"with candidate(s) <strong>{names}</strong>. "
            "LLMs are known to exhibit self-preference bias. "
            "Consider re-running with a different-family judge for an independent baseline.</p>"
        )
