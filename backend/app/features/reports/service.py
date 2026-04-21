from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from html import escape
from pathlib import Path

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
        report = self._build_report_view_model(run)
        html = self._render_html(report)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        html_output_path = self.output_dir / f"run-{run.id}.html"
        pdf_output_path = self.output_dir / f"run-{run.id}.pdf"
        html_output_path.write_text(html, encoding="utf-8")
        await self._render_pdf(html, pdf_output_path)

        run.html_report_path = str(html_output_path)
        run.pdf_report_path = str(pdf_output_path)
        run.report_status = "completed"
        run.status = "completed"
        await self.repository.commit()
        return ReportArtifactRead(
            run_id=run.id,
            report_status=run.report_status,
            html_report_path=run.html_report_path,
            pdf_report_path=run.pdf_report_path,
        )

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
        judge_snapshot = next(
            (snapshot for snapshot in run.model_snapshots if snapshot.role == "judge"),
            None,
        )
        if not candidate_snapshots or judge_snapshot is None:
            raise ReportError(
                "Run does not contain the snapshots needed for reporting."
            )
        if not run.global_summaries:
            raise ReportError("Run has no aggregated summaries to report.")

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

        summary_matrix = [
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

        candidate_sections = [
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

        prompt_sections = [
            ReportPromptSectionRead(
                prompt_snapshot_id=prompt.id,
                prompt_name=prompt.name,
                category_name=prompt.category_name,
                system_prompt_text=prompt.system_prompt_text,
                user_prompt_text=prompt.user_prompt_text,
                evaluation_notes=prompt.evaluation_notes,
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
                key=lambda item: item.snapshot_order,
            )
        ]

        return RunReportRead(
            run_id=run.id,
            report_title=f"{run.name} Report",
            benchmark_session_name=run.name,
            launched_at=run.launched_at,
            judge_name=judge_snapshot.display_name,
            prompt_count=len(run.prompt_snapshots),
            candidate_count=len(candidate_snapshots),
            summary_matrix=summary_matrix,
            candidate_sections=candidate_sections,
            prompt_sections=prompt_sections,
        )

    def _build_prompt_candidate(
        self,
        run: SessionRun,
        response: CandidateResponse,
    ) -> ReportPromptCandidateRead:
        evaluation_candidate = next(
            (
                candidate
                for batch in run.judge_batches
                if batch.batch_type == "absolute" and batch.evaluation is not None
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
        )

    def _model_snapshot(self, run: SessionRun, model_snapshot_id: int):
        return next(
            snapshot
            for snapshot in run.model_snapshots
            if snapshot.id == model_snapshot_id
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

    def _render_html(self, report: RunReportRead) -> str:
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

        summary_rows = ""
        for i, row in enumerate(report.summary_matrix):
            score = Decimal(row.final_global_score or "0")
            delta = score - best_score
            delta_str = "—" if i == 0 else f"{delta:+.2f}"
            cost_raw = f"${row.total_estimated_cost}" if row.total_estimated_cost else "—"
            latency_raw = f"{row.avg_duration_ms} ms" if row.avg_duration_ms is not None else "—"
            winner = i == 0
            summary_rows += (
                f"<tr{'  class=\"winner-row\"' if winner else ''}>"
                f"<td>{'★ ' if winner else ''}<strong>{escape(row.candidate_name)}</strong></td>"
                f"<td>{escape(row.judge_score)}</td>"
                f"<td>{escape(row.quality_score)}</td>"
                f"<td>{escape(cost_raw)}</td>"
                f"<td>{escape(latency_raw)}</td>"
                f"<td><strong>{escape(row.final_global_score or '—')}</strong></td>"
                f"<td class='{'delta-zero' if i == 0 else 'delta-neg'}'>{escape(delta_str)}</td>"
                "</tr>"
            )

        candidate_sections = ""
        for section in report.candidate_sections:
            cost_raw = f"${section.total_estimated_cost}" if section.total_estimated_cost else "—"
            latency_raw = f"{section.avg_duration_ms} ms" if section.avg_duration_ms is not None else "—"
            tps_raw = f"{section.avg_tokens_per_second} tok/s" if section.avg_tokens_per_second else "—"
            sub_rows = "".join(
                f"<tr><td>{label}</td><td>{escape(val or '—')}</td></tr>"
                for label, val in [
                    ("Relevance", section.average_relevance_score),
                    ("Accuracy", section.average_accuracy_score),
                    ("Completeness", section.average_completeness_score),
                    ("Clarity", section.average_clarity_score),
                    ("Instruction Following", section.average_instruction_following_score),
                ]
            )
            candidate_sections += (
                "<section class='candidate'>"
                f"<h3>{escape(section.candidate_name)}</h3>"
                f"<p class='muted'>{escape(section.provider_type)} / {escape(section.runtime_type)}</p>"
                "<div class='stat-row'>"
                f"<div class='stat-box'><span class='stat-val'>{escape(section.final_global_score or '—')}</span><span class='stat-lbl'>Global Score</span></div>"
                f"<div class='stat-box'><span class='stat-val'>{escape(latency_raw)}</span><span class='stat-lbl'>Avg Latency</span></div>"
                f"<div class='stat-box'><span class='stat-val'>{escape(tps_raw)}</span><span class='stat-lbl'>Throughput</span></div>"
                f"<div class='stat-box'><span class='stat-val'>{escape(cost_raw)}</span><span class='stat-lbl'>Total Cost</span></div>"
                "</div>"
                "<table class='sub-scores'>"
                "<thead><tr><th>Dimension</th><th>Avg Score</th></tr></thead>"
                f"<tbody>{sub_rows}</tbody>"
                "</table>"
                f"<p>{escape(section.global_summary_text or 'No summary available.')}</p>"
                "<div class='patterns'>"
                f"<div class='pattern-block strengths-block'><strong>Strengths</strong><p>{escape(section.best_patterns_text or '—')}</p></div>"
                f"<div class='pattern-block weaknesses-block'><strong>Weaknesses</strong><p>{escape(section.weak_patterns_text or '—')}</p></div>"
                "</div>"
                "</section>"
            )

        prompt_sections = ""
        for section in report.prompt_sections:
            cmp_rows = ""
            for c in sorted(section.candidates, key=lambda x: int(x.ranking_in_batch or 999)):
                try:
                    q_per_tok = (
                        f"{float(c.overall_score) / c.total_tokens * 100:.2f}"
                        if c.overall_score and c.total_tokens
                        else "—"
                    )
                except (ZeroDivisionError, ValueError):
                    q_per_tok = "—"
                cmp_rows += (
                    f"<tr>"
                    f"<td>{escape(c.candidate_name)}</td>"
                    f"<td><strong>{escape(c.overall_score or '—')}</strong></td>"
                    f"<td>#{escape(str(c.ranking_in_batch or '—'))}</td>"
                    f"<td>{escape(str(c.duration_ms) + ' ms' if c.duration_ms else '—')}</td>"
                    f"<td>{escape(str(c.total_tokens) if c.total_tokens else '—')}</td>"
                    f"<td>{escape('$' + c.estimated_cost if c.estimated_cost else '—')}</td>"
                    f"<td>{escape(q_per_tok)}</td>"
                    "</tr>"
                )
            sys_prompt_html = (
                f"<p class='prompt-label'>System prompt</p><pre class='sys-pre'>{escape(section.system_prompt_text)}</pre>"
                if section.system_prompt_text
                else ""
            )
            eval_notes_html = (
                f"<p class='eval-notes'><strong>Evaluation criteria:</strong> {escape(section.evaluation_notes)}</p>"
                if section.evaluation_notes
                else ""
            )
            responses_html = ""
            for c in section.candidates:
                strengths_html = (
                    f"<p class='strengths'><strong>Strengths:</strong> {escape(c.strengths_text)}</p>"
                    if c.strengths_text
                    else ""
                )
                weaknesses_html = (
                    f"<p class='weaknesses'><strong>Weaknesses:</strong> {escape(c.weaknesses_text)}</p>"
                    if c.weaknesses_text
                    else ""
                )
                responses_html += (
                    "<article class='response'>"
                    f"<h4>{escape(c.candidate_name)}</h4>"
                    f"<pre>{escape(c.normalized_response_text or 'No response')}</pre>"
                    f"{strengths_html}"
                    f"{weaknesses_html}"
                    f"<p class='feedback'>{escape(c.detailed_feedback or 'No detailed feedback')}</p>"
                    "</article>"
                )

            prompt_sections += (
                "<section class='prompt'>"
                f"<h3>{escape(section.prompt_name)}</h3>"
                f"<p><span class='badge'>{escape(section.category_name)}</span></p>"
                f"{sys_prompt_html}"
                "<p class='prompt-label'>User prompt</p>"
                f"<pre>{escape(section.user_prompt_text)}</pre>"
                f"{eval_notes_html}"
                "<table class='comparison'>"
                "<thead><tr><th>Candidate</th><th>Score</th><th>Rank</th><th>Latency</th><th>Tokens</th><th>Cost</th><th title='Quality points per 100 tokens consumed'>Qual/100 tok</th></tr></thead>"
                f"<tbody>{cmp_rows}</tbody>"
                "</table>"
                f"{responses_html}"
                "</section>"
            )

        return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(report.report_title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
    <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
    <style>
      :root {{
        --ink: #0f172a;
        --ink-soft: #334155;
        --muted: #64748b;
        --line: #e2e8f0;
        --panel: #f8fafc;
        --primary: #3b82f6;
        --primary-light: #eff6ff;
        --primary-border: #bfdbfe;
        --accent-light: #f0f9ff;
        --green-bg: #dcfce7;
        --red-bg: #fee2e2;
        --yellow-bg: #fefce8;
        --radius: 8px;
        --shadow: 0 1px 3px rgba(15,23,42,0.07), 0 1px 2px rgba(15,23,42,0.04);
        --shadow-md: 0 4px 6px -1px rgba(15,23,42,0.07), 0 2px 4px -2px rgba(15,23,42,0.05);
      }}
      * {{ box-sizing: border-box; margin: 0; padding: 0; }}
      body {{
        padding: 40px 48px;
        font-family: 'Manrope', system-ui, -apple-system, sans-serif;
        color: var(--ink);
        background: #f1f5f9;
        line-height: 1.65;
        font-size: 14px;
      }}
      h1 {{
        font-family: 'Space Grotesk', 'Manrope', system-ui, sans-serif;
        font-size: 1.9rem;
        font-weight: 700;
        margin-bottom: 4px;
        letter-spacing: -0.025em;
      }}
      h2 {{
        font-family: 'Space Grotesk', 'Manrope', system-ui, sans-serif;
        font-size: 0.72rem;
        font-weight: 700;
        margin: 36px 0 14px;
        border-bottom: 1px solid var(--line);
        padding-bottom: 8px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }}
      h3 {{ font-size: 1rem; font-weight: 600; margin-bottom: 8px; }}
      h4 {{ font-size: 0.9rem; font-weight: 600; margin-bottom: 6px; color: var(--primary); }}
      p {{ margin-bottom: 8px; }}
      .muted {{ color: var(--muted); font-size: 0.85rem; margin-bottom: 12px; }}
      .hero {{
        background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 28px 32px;
        margin-bottom: 32px;
        box-shadow: var(--shadow-md);
      }}
      .meta {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 16px; }}
      .meta div {{
        border: 1px solid var(--line);
        background: white;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 0.875rem;
      }}
      .meta div strong {{
        color: var(--muted);
        font-weight: 600;
        display: block;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 3px;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0 24px;
        font-size: 0.875rem;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow: hidden;
        background: white;
        box-shadow: var(--shadow);
      }}
      th, td {{ border-bottom: 1px solid var(--line); padding: 10px 14px; text-align: left; }}
      th {{
        background: var(--panel);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }}
      tr:last-child td {{ border-bottom: none; }}
      tbody tr:hover td {{ background: #f8fafc; }}
      .winner-row td {{ background: var(--yellow-bg) !important; }}
      .winner-row td:first-child {{ border-left: 3px solid #eab308; padding-left: 11px; }}
      .delta-zero {{ color: var(--muted); }}
      .delta-neg {{ color: #dc2626; font-weight: 600; }}
      .candidate-grid, .prompt-grid {{ display: grid; gap: 20px; }}
      .candidate {{
        border: 1px solid var(--line);
        background: white;
        padding: 24px;
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }}
      .stat-row {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }}
      .stat-box {{
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 12px 14px;
        text-align: center;
      }}
      .stat-val {{
        display: block;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--primary);
        font-family: 'Space Grotesk', system-ui, sans-serif;
      }}
      .stat-lbl {{
        display: block;
        font-size: 0.68rem;
        color: var(--muted);
        margin-top: 3px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
      }}
      table.sub-scores {{ margin: 0 0 14px; box-shadow: none; }}
      table.sub-scores td:first-child {{ color: var(--muted); font-size: 0.85rem; font-weight: 500; }}
      .patterns {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }}
      .pattern-block {{ padding: 14px 16px; border-radius: 6px; font-size: 0.875rem; }}
      .strengths-block {{ background: var(--green-bg); border-left: 3px solid #22c55e; }}
      .weaknesses-block {{ background: var(--red-bg); border-left: 3px solid #ef4444; }}
      .pattern-block strong {{
        display: block;
        margin-bottom: 6px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }}
      .prompt {{
        border: 1px solid var(--line);
        background: white;
        padding: 24px;
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }}
      .badge {{
        display: inline-block;
        background: var(--accent-light);
        color: #0369a1;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 2px 10px;
        border-radius: 20px;
        margin-bottom: 12px;
        border: 1px solid #bae6fd;
      }}
      .prompt-label {{
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
        margin-bottom: 4px;
      }}
      pre {{
        white-space: pre-wrap;
        word-break: break-word;
        background: var(--panel);
        border: 1px solid var(--line);
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 0.82rem;
        margin-bottom: 12px;
        font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
        line-height: 1.55;
      }}
      pre.sys-pre {{ background: #fffbeb; border-color: #fde68a; }}
      .eval-notes {{ font-size: 0.875rem; color: var(--muted); margin-bottom: 10px; }}
      table.comparison {{ margin: 12px 0 18px; }}
      .response {{
        border: 1px solid var(--line);
        padding: 18px;
        margin-top: 12px;
        border-radius: 6px;
        background: white;
      }}
      .response h4 {{ margin-bottom: 10px; }}
      p.strengths {{ background: var(--green-bg); border-left: 3px solid #22c55e; padding: 8px 12px; border-radius: 4px; font-size: 0.875rem; margin-bottom: 6px; }}
      p.weaknesses {{ background: var(--red-bg); border-left: 3px solid #ef4444; padding: 8px 12px; border-radius: 4px; font-size: 0.875rem; margin-bottom: 6px; }}
      p.feedback {{ font-size: 0.875rem; color: var(--muted); margin-top: 8px; }}
      .bias-notice {{
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-left: 4px solid #f59e0b;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 0.875rem;
        margin-bottom: 16px;
      }}
      .weighting-legend {{
        background: white;
        border: 1px solid var(--line);
        padding: 12px 18px;
        border-radius: var(--radius);
        font-size: 0.875rem;
        margin-bottom: 18px;
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
        align-items: center;
        box-shadow: var(--shadow);
      }}
      .weight-pill {{
        background: var(--primary-light);
        color: var(--primary);
        font-weight: 700;
        padding: 2px 10px;
        border-radius: 20px;
        font-size: 0.78rem;
        border: 1px solid var(--primary-border);
      }}
      .charts-grid {{
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin-bottom: 14px;
      }}
      .chart-box {{
        border: 1px solid var(--line);
        background: white;
        padding: 20px;
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }}
      .chart-box h3 {{ font-size: 0.9rem; font-weight: 600; margin-bottom: 4px; }}
      @media print {{
        body {{ padding: 0; background: white; font-size: 13px; }}
        .hero {{ background: white; box-shadow: none; border-radius: 0; border: none; border-bottom: 2px solid var(--line); padding: 20px 0; margin-bottom: 20px; }}
        .candidate, .prompt {{ box-shadow: none; }}
        table {{ box-shadow: none; }}
        h2 {{ margin: 24px 0 10px; }}
        .charts-grid {{ grid-template-columns: 1fr; gap: 16px; }}
        .prompt {{ page-break-inside: avoid; }}
        .candidate {{ page-break-inside: avoid; }}
      }}
    </style>
  </head>
  <body>
    <section class="hero">
      <h1>{escape(report.report_title)}</h1>
      <p class="muted">{escape(report.benchmark_session_name)}</p>
      <div class="meta">
        <div><strong>Run timestamp</strong>{escape(report.launched_at.isoformat())}</div>
        <div><strong>Judge</strong>{escape(report.judge_name)}</div>
        <div><strong>Prompts</strong>{report.prompt_count}</div>
        <div><strong>Candidates</strong>{report.candidate_count}</div>
      </div>
    </section>
    {judge_bias_html}
    <section>
      <h2>Executive Summary</h2>
      <div class="weighting-legend">
        <span><strong>Global Score formula:</strong></span>
        <span><span class="weight-pill">{_QUALITY_WEIGHT_PCT}%</span> Judge Score (holistic quality)</span>
        <span>+</span>
        <span><span class="weight-pill">{_COST_WEIGHT_PCT}%</span> Cost Score (normalised inverse)</span>
        <span>+</span>
        <span><span class="weight-pill">{_PERFORMANCE_WEIGHT_PCT}%</span> Performance Score (latency + throughput, normalised)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Judge score</th>
            <th>Quality score</th>
            <th>Total cost</th>
            <th>Avg latency</th>
            <th>Global score</th>
            <th>Δ vs leader</th>
          </tr>
        </thead>
        <tbody>{summary_rows}</tbody>
      </table>
      {f'<h3 style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:20px 0 8px">Score by Category</h3>{category_html}' if category_html else ''}
    </section>
    <section>
      <h2>Visual Analysis</h2>
      <div class="charts-grid">
        <div class="chart-box">
          <h3>Sub-Score Radar</h3>
          <p class="muted" style="font-size:0.8rem;margin-bottom:6px">Dimension-level averages — shows the "personality" of each model.</p>
          {radar_plotly}
        </div>
        <div class="chart-box">
          <h3>Efficiency Frontier — Latency vs Quality</h3>
          <p class="muted" style="font-size:0.8rem;margin-bottom:6px">Upper-left is ideal: high quality at low latency.</p>
          {scatter_plotly}
        </div>
        <div class="chart-box">
          <h3>Category Efficiency Radar</h3>
          <p class="muted" style="font-size:0.8rem;margin-bottom:6px">Average judge score per prompt category.</p>
          {category_radar_plotly}
        </div>
      </div>
    </section>
    <section>
      <h2>Candidate Sections</h2>
      <div class="candidate-grid">{candidate_sections}</div>
    </section>
    <section>
      <h2>Prompt Sections</h2>
      <div class="prompt-grid">{prompt_sections}</div>
    </section>
  </body>
</html>"""

    async def _render_pdf(self, html: str, output_path: Path) -> None:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_content(html, wait_until="networkidle")
            # Ensure all Plotly charts have finished rendering before export
            await page.wait_for_function(
                "() => document.querySelectorAll('.js-plotly-plot .main-svg').length > 0",
                timeout=20_000,
            )
            await page.pdf(
                path=str(output_path),
                format="A4",
                print_background=True,
                margin={"top": "15mm", "bottom": "15mm", "left": "15mm", "right": "15mm"},
            )
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
                font=dict(family="Manrope, sans-serif", size=10.5, color="#334155"),
                bgcolor="rgba(255,255,255,0.9)",
                bordercolor="#e2e8f0",
                borderwidth=1,
                orientation="h",
                yanchor="bottom",
                y=-0.22,
                xanchor="center",
                x=0.5,
            ),
            margin=dict(l=30, r=30, t=10, b=55),
            height=310,
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
                marker=dict(
                    size=18,
                    color=color,
                    line=dict(color="white", width=2.5),
                    opacity=0.92,
                ),
                name=name,
                hovertemplate="<b>%{fullData.name}</b><br>Latency: %{x:.0f} ms<br>Quality: %{y:.1f}<extra></extra>",
            ))

        offsets = self._scatter_label_offsets([(lat, qual) for _, lat, qual in data])
        annotations = []
        for ci, ((name, lat, qual), (ax, ay)) in enumerate(zip(data, offsets)):
            color = _CHART_PALETTE[ci % len(_CHART_PALETTE)]
            annotations.append(dict(
                x=lat,
                y=qual,
                xref="x",
                yref="y",
                text=f"<b>{escape(name)}</b><br><span style='color:#64748b;font-size:9px'>{lat:,} ms &nbsp;·&nbsp; q={qual:.1f}</span>",
                showarrow=True,
                arrowhead=2,
                arrowsize=0.8,
                arrowwidth=1.4,
                arrowcolor=color,
                ax=ax,
                ay=ay,
                axref="pixel",
                ayref="pixel",
                font=dict(size=10, color="#1e293b", family="Manrope, sans-serif"),
                bgcolor="rgba(255,255,255,0.94)",
                bordercolor=color,
                borderwidth=1.5,
                borderpad=5,
                align="left",
            ))

        fig.update_layout(
            annotations=annotations,
            xaxis=dict(
                title=dict(
                    text="Latency (ms) — lower is faster →",
                    font=dict(size=11, family="Manrope, sans-serif", color="#64748b"),
                ),
                gridcolor="#f1f5f9",
                linecolor="#e2e8f0",
                tickfont=dict(size=9.5, color="#94a3b8", family="Manrope, sans-serif"),
                zeroline=False,
            ),
            yaxis=dict(
                title=dict(
                    text="Quality score ↑",
                    font=dict(size=11, family="Manrope, sans-serif", color="#64748b"),
                ),
                gridcolor="#f1f5f9",
                linecolor="#e2e8f0",
                tickfont=dict(size=9.5, color="#94a3b8", family="Manrope, sans-serif"),
                zeroline=False,
                range=[0, 100],
            ),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(248,250,252,0.6)",
            legend=dict(
                font=dict(family="Manrope, sans-serif", size=10.5, color="#334155"),
                bgcolor="rgba(255,255,255,0.9)",
                bordercolor="#e2e8f0",
                borderwidth=1,
                orientation="h",
                yanchor="bottom",
                y=-0.30,
                xanchor="center",
                x=0.5,
            ),
            showlegend=True,
            margin=dict(l=55, r=20, t=20, b=80),
            height=370,
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
                font=dict(family="Manrope, sans-serif", size=10.5, color="#334155"),
                bgcolor="rgba(255,255,255,0.9)",
                bordercolor="#e2e8f0",
                borderwidth=1,
                orientation="h",
                yanchor="bottom",
                y=-0.22,
                xanchor="center",
                x=0.5,
            ),
            margin=dict(l=30, r=30, t=10, b=55),
            height=310,
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
        headers = "<th>Category</th>" + "".join(f"<th>{escape(n)}</th>" for n in candidate_names)

        rows = ""
        for cat in sorted(by_cat):
            rows += f"<tr><td><strong>{escape(cat)}</strong></td>"
            for name in candidate_names:
                scores = by_cat[cat].get(name, [])
                if scores:
                    avg = sum(scores) / len(scores)
                    rows += f"<td>{avg:.1f}</td>"
                else:
                    rows += "<td>—</td>"
            rows += "</tr>"

        return (
            "<table class='comparison'>"
            f"<thead><tr>{headers}</tr></thead>"
            f"<tbody>{rows}</tbody>"
            "</table>"
        )

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
