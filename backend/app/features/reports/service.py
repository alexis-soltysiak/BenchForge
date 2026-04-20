from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from html import escape
from pathlib import Path

# Mirrors aggregation/service.py weights — kept here for display only
_QUALITY_WEIGHT_PCT = 70
_COST_WEIGHT_PCT = 15
_PERFORMANCE_WEIGHT_PCT = 15

from weasyprint import HTML
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
        self._render_pdf(html, pdf_output_path)

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
        radar_svg = self._render_radar_svg(report)
        scatter_svg = self._render_scatter_svg(report)
        category_radar_svg = self._render_category_radar_svg(report)
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
                f"<div class='stat-box'><span class='stat-val'>{escape(section.final_global_score or '—')}</span><span class='stat-lbl'>global score</span></div>"
                f"<div class='stat-box'><span class='stat-val'>{escape(latency_raw)}</span><span class='stat-lbl'>avg latency</span></div>"
                f"<div class='stat-box'><span class='stat-val'>{escape(tps_raw)}</span><span class='stat-lbl'>throughput</span></div>"
                f"<div class='stat-box'><span class='stat-val'>{escape(cost_raw)}</span><span class='stat-lbl'>total cost</span></div>"
                "</div>"
                "<table class='sub-scores'>"
                "<thead><tr><th>Dimension</th><th>Avg score</th></tr></thead>"
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
    <style>
      :root {{
        --ink: #0f172a;
        --muted: #475569;
        --line: #dbe4ee;
        --panel: #f8fafc;
        --accent: #0f766e;
        --accent-light: #eef6f4;
        --green: #166534;
        --green-bg: #dcfce7;
        --red: #991b1b;
        --red-bg: #fee2e2;
        --yellow-bg: #fef9c3;
      }}
      * {{ box-sizing: border-box; margin: 0; padding: 0; }}
      body {{
        padding: 40px;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background: white;
        line-height: 1.6;
        font-size: 14px;
      }}
      h1 {{ font-size: 1.8rem; margin-bottom: 4px; }}
      h2 {{ font-size: 1.2rem; margin: 32px 0 12px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }}
      h3 {{ font-size: 1.05rem; margin-bottom: 8px; }}
      h4 {{ font-size: 0.95rem; margin-bottom: 6px; color: var(--accent); }}
      p {{ margin-bottom: 8px; }}
      .muted {{ color: var(--muted); font-size: 0.88rem; margin-bottom: 12px; }}
      .hero {{ border-bottom: 2px solid var(--line); padding-bottom: 20px; margin-bottom: 8px; }}
      .meta {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 14px; }}
      .meta div {{ border: 1px solid var(--line); background: var(--panel); padding: 12px 16px; border-radius: 4px; font-size: 0.9rem; }}
      table {{ width: 100%; border-collapse: collapse; margin: 14px 0 24px; font-size: 0.9rem; }}
      th, td {{ border: 1px solid var(--line); padding: 9px 12px; text-align: left; }}
      th {{ background: var(--accent-light); font-family: Helvetica, Arial, sans-serif; font-size: 0.82rem; letter-spacing: 0.03em; }}
      tr:nth-child(even) td {{ background: var(--panel); }}
      .winner-row td {{ background: var(--yellow-bg) !important; }}
      .delta-zero {{ color: var(--muted); }}
      .delta-neg {{ color: #b91c1c; font-weight: bold; }}
      .candidate-grid, .prompt-grid {{ display: grid; gap: 20px; }}
      .candidate {{ border: 1px solid var(--line); background: var(--panel); padding: 20px; border-radius: 6px; }}
      .stat-row {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }}
      .stat-box {{ background: white; border: 1px solid var(--line); border-radius: 4px; padding: 10px 14px; text-align: center; }}
      .stat-val {{ display: block; font-size: 1.15rem; font-weight: bold; color: var(--accent); }}
      .stat-lbl {{ display: block; font-size: 0.75rem; color: var(--muted); margin-top: 2px; font-family: Helvetica, Arial, sans-serif; }}
      table.sub-scores {{ margin: 0 0 14px; }}
      table.sub-scores td:first-child {{ color: var(--muted); font-family: Helvetica, Arial, sans-serif; font-size: 0.85rem; }}
      .patterns {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }}
      .pattern-block {{ padding: 12px 14px; border-radius: 4px; font-size: 0.9rem; }}
      .strengths-block {{ background: var(--green-bg); border-left: 3px solid #16a34a; }}
      .weaknesses-block {{ background: var(--red-bg); border-left: 3px solid #dc2626; }}
      .pattern-block strong {{ display: block; margin-bottom: 4px; font-family: Helvetica, Arial, sans-serif; font-size: 0.82rem; letter-spacing: 0.04em; text-transform: uppercase; }}
      .prompt {{ border: 1px solid var(--line); background: white; padding: 20px; border-radius: 6px; }}
      .badge {{ display: inline-block; background: var(--accent-light); color: var(--accent); font-size: 0.78rem; font-family: Helvetica, Arial, sans-serif; padding: 2px 10px; border-radius: 12px; margin-bottom: 12px; }}
      .prompt-label {{ font-family: Helvetica, Arial, sans-serif; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 4px; }}
      pre {{ white-space: pre-wrap; word-break: break-word; background: var(--panel); border: 1px solid var(--line); padding: 12px 14px; border-radius: 4px; font-size: 0.85rem; margin-bottom: 12px; }}
      pre.sys-pre {{ background: #fffbeb; border-color: #fbbf24; }}
      .eval-notes {{ font-size: 0.88rem; color: var(--muted); margin-bottom: 10px; }}
      table.comparison {{ margin: 10px 0 18px; }}
      .response {{ border: 1px solid var(--line); padding: 16px; margin-top: 12px; border-radius: 4px; }}
      .response h4 {{ margin-bottom: 10px; }}
      p.strengths {{ background: var(--green-bg); padding: 8px 12px; border-radius: 4px; font-size: 0.88rem; margin-bottom: 6px; }}
      p.weaknesses {{ background: var(--red-bg); padding: 8px 12px; border-radius: 4px; font-size: 0.88rem; margin-bottom: 6px; }}
      p.feedback {{ font-size: 0.88rem; color: var(--muted); margin-top: 8px; }}
      .bias-notice {{ background: #fffbeb; border: 1px solid #fbbf24; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 4px; font-size: 0.88rem; margin-bottom: 14px; }}
      .weighting-legend {{ background: var(--panel); border: 1px solid var(--line); padding: 10px 16px; border-radius: 4px; font-size: 0.88rem; margin-bottom: 16px; display: flex; gap: 20px; flex-wrap: wrap; align-items: center; }}
      .weighting-legend span {{ font-family: Helvetica, Arial, sans-serif; }}
      .weight-pill {{ background: var(--accent-light); color: var(--accent); font-weight: bold; padding: 2px 8px; border-radius: 10px; font-size: 0.82rem; }}
      .charts-grid {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 10px; }}
      .chart-box {{ border: 1px solid var(--line); background: var(--panel); padding: 16px; border-radius: 6px; }}
      .chart-box h3 {{ font-size: 0.95rem; margin-bottom: 10px; }}
      @media print {{
        body {{ padding: 0; }}
        .prompt {{ page-break-inside: avoid; }}
        .prompt-grid {{ page-break-before: always; }}
        .charts-grid {{ grid-template-columns: 1fr; }}
      }}
    </style>
  </head>
  <body>
    <section class="hero">
      <h1>{escape(report.report_title)}</h1>
      <p class="muted">{escape(report.benchmark_session_name)}</p>
      <div class="meta">
        <div><strong>Run timestamp:</strong> {escape(report.launched_at.isoformat())}</div>
        <div><strong>Judge:</strong> {escape(report.judge_name)}</div>
        <div><strong>Prompts:</strong> {report.prompt_count}</div>
        <div><strong>Candidates:</strong> {report.candidate_count}</div>
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
      {f'<h3 style="font-size:0.95rem;margin:20px 0 8px">Score by Category</h3>{category_html}' if category_html else ''}
    </section>
    <section>
      <h2>Visual Analysis</h2>
      <div class="charts-grid">
        <div class="chart-box">
          <h3>Sub-Score Radar</h3>
          <p class="muted" style="font-size:0.82rem;margin-bottom:8px">Dimension-level averages across all prompts — shows the "personality" of each model.</p>
          {radar_svg}
        </div>
        <div class="chart-box">
          <h3>Efficiency Frontier — Latency vs Quality</h3>
          <p class="muted" style="font-size:0.82rem;margin-bottom:8px">Upper-left is ideal: high quality at low latency. The Global Score may penalise a slow but accurate model — use this to judge the trade-off yourself.</p>
          {scatter_svg}
        </div>
        <div class="chart-box">
          <h3>Category Efficiency Radar</h3>
          <p class="muted" style="font-size:0.82rem;margin-bottom:8px">Average judge score per prompt category. Shows where each model excels or struggles by task type.</p>
          {category_radar_svg}
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

    def _render_pdf(self, html: str, output_path: Path) -> None:
        HTML(string=html).write_pdf(str(output_path))

    def _render_radar_svg(self, report: RunReportRead) -> str:
        dims = ["Relevance", "Accuracy", "Completeness", "Clarity", "Instr. Following"]
        palette = ["#0f766e", "#f97316", "#3b82f6", "#a855f7"]
        cx, cy, r = 185, 185, 130
        n = len(dims)

        def axis_angle(i: int) -> float:
            return math.pi / 2 - (2 * math.pi * i / n)

        def polar(val: float, i: int) -> tuple[float, float]:
            a = axis_angle(i)
            d = r * val / 100
            return cx + d * math.cos(a), cy - d * math.sin(a)

        parts: list[str] = ['<svg viewBox="0 0 500 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:520px;display:block">']

        for pct in (0.25, 0.5, 0.75, 1.0):
            pts = " ".join(f"{polar(100 * pct, i)[0]:.1f},{polar(100 * pct, i)[1]:.1f}" for i in range(n))
            parts.append(f'<polygon points="{pts}" fill="none" stroke="#dbe4ee" stroke-width="{1.5 if pct == 1.0 else 0.8}"/>')
            if pct < 1.0:
                gx, gy = polar(100 * pct, 0)
                parts.append(f'<text x="{gx + 3:.1f}" y="{gy:.1f}" font-size="8" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">{int(pct * 100)}</text>')

        for i in range(n):
            ex, ey = polar(100, i)
            parts.append(f'<line x1="{cx}" y1="{cy}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="#dbe4ee" stroke-width="1"/>')
            lx, ly = polar(118, i)
            anchor = "middle"
            if lx < cx - 8:
                anchor = "end"
            elif lx > cx + 8:
                anchor = "start"
            parts.append(f'<text x="{lx:.1f}" y="{ly + 4:.1f}" text-anchor="{anchor}" font-size="11" fill="#475569" font-family="Helvetica,Arial,sans-serif">{dims[i]}</text>')

        for ci, section in enumerate(report.candidate_sections):
            vals = [
                float(section.average_relevance_score or "0"),
                float(section.average_accuracy_score or "0"),
                float(section.average_completeness_score or "0"),
                float(section.average_clarity_score or "0"),
                float(section.average_instruction_following_score or "0"),
            ]
            color = palette[ci % len(palette)]
            pts = " ".join(f"{polar(v, i)[0]:.1f},{polar(v, i)[1]:.1f}" for i, v in enumerate(vals))
            parts.append(f'<polygon points="{pts}" fill="{color}" fill-opacity="0.12" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>')
            for i, v in enumerate(vals):
                px, py = polar(v, i)
                parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="{color}"/>')

        legend_x, legend_y0 = 390, 50
        for ci, section in enumerate(report.candidate_sections):
            color = palette[ci % len(palette)]
            ly = legend_y0 + ci * 26
            parts.append(f'<rect x="{legend_x}" y="{ly}" width="13" height="13" fill="{color}" fill-opacity="0.7" rx="2"/>')
            parts.append(f'<text x="{legend_x + 17}" y="{ly + 10}" font-size="11" fill="#0f172a" font-family="Helvetica,Arial,sans-serif">{escape(section.candidate_name)}</text>')

        parts.append("</svg>")
        return "\n".join(parts)

    def _render_category_radar_svg(self, report: RunReportRead) -> str:
        by_cat: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        for section in report.prompt_sections:
            for c in section.candidates:
                if c.overall_score:
                    by_cat[section.category_name][c.candidate_name].append(float(c.overall_score))

        categories = sorted(by_cat)
        if len(categories) < 3:
            return "<p class='muted'>At least 3 categories are needed to render a radar chart.</p>"

        palette = ["#0f766e", "#f97316", "#3b82f6", "#a855f7"]
        cx, cy, r = 185, 185, 130
        n = len(categories)

        def axis_angle(i: int) -> float:
            return math.pi / 2 - (2 * math.pi * i / n)

        def polar(val: float, i: int) -> tuple[float, float]:
            a = axis_angle(i)
            d = r * val / 100
            return cx + d * math.cos(a), cy - d * math.sin(a)

        parts: list[str] = ['<svg viewBox="0 0 500 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:520px;display:block">']

        for pct in (0.25, 0.5, 0.75, 1.0):
            pts = " ".join(f"{polar(100 * pct, i)[0]:.1f},{polar(100 * pct, i)[1]:.1f}" for i in range(n))
            parts.append(f'<polygon points="{pts}" fill="none" stroke="#dbe4ee" stroke-width="{1.5 if pct == 1.0 else 0.8}"/>')
            if pct < 1.0:
                gx, gy = polar(100 * pct, 0)
                parts.append(f'<text x="{gx + 3:.1f}" y="{gy:.1f}" font-size="8" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">{int(pct * 100)}</text>')

        for i, cat in enumerate(categories):
            ex, ey = polar(100, i)
            parts.append(f'<line x1="{cx}" y1="{cy}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="#dbe4ee" stroke-width="1"/>')
            lx, ly = polar(118, i)
            anchor = "middle"
            if lx < cx - 8:
                anchor = "end"
            elif lx > cx + 8:
                anchor = "start"
            parts.append(f'<text x="{lx:.1f}" y="{ly + 4:.1f}" text-anchor="{anchor}" font-size="11" fill="#475569" font-family="Helvetica,Arial,sans-serif">{escape(cat)}</text>')

        for ci, section in enumerate(report.candidate_sections):
            vals = []
            for cat in categories:
                scores = by_cat[cat].get(section.candidate_name, [])
                vals.append(sum(scores) / len(scores) if scores else 0.0)
            color = palette[ci % len(palette)]
            pts = " ".join(f"{polar(v, i)[0]:.1f},{polar(v, i)[1]:.1f}" for i, v in enumerate(vals))
            parts.append(f'<polygon points="{pts}" fill="{color}" fill-opacity="0.12" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>')
            for i, v in enumerate(vals):
                px, py = polar(v, i)
                parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="{color}"/>')
                parts.append(f'<text x="{px + 5:.1f}" y="{py + 4:.1f}" font-size="9" fill="{color}" font-family="Helvetica,Arial,sans-serif">{v:.0f}</text>')

        legend_x, legend_y0 = 390, 50
        for ci, section in enumerate(report.candidate_sections):
            color = palette[ci % len(palette)]
            ly = legend_y0 + ci * 26
            parts.append(f'<rect x="{legend_x}" y="{ly}" width="13" height="13" fill="{color}" fill-opacity="0.7" rx="2"/>')
            parts.append(f'<text x="{legend_x + 17}" y="{ly + 10}" font-size="11" fill="#0f172a" font-family="Helvetica,Arial,sans-serif">{escape(section.candidate_name)}</text>')

        parts.append("</svg>")
        return "\n".join(parts)

    def _render_scatter_svg(self, report: RunReportRead) -> str:
        data = [
            (s.candidate_name, s.avg_duration_ms, float(s.average_overall_score or "0"))
            for s in report.candidate_sections
            if s.avg_duration_ms is not None
        ]
        if not data:
            return "<p class='muted'>No latency data available for efficiency chart.</p>"

        palette = ["#0f766e", "#f97316", "#3b82f6", "#a855f7"]
        pl, pr, pt, pb = 65, 40, 30, 50
        w, h = 520, 300
        pw, ph = w - pl - pr, h - pt - pb

        lats = [d[1] for d in data]
        quals = [d[2] for d in data]
        spread_lat = max(lats) - min(lats) if len(set(lats)) > 1 else max(lats) * 0.5
        spread_qual = max(quals) - min(quals) if len(set(quals)) > 1 else 10.0

        min_lat = min(lats) - spread_lat * 0.3
        max_lat = max(lats) + spread_lat * 0.3
        min_q = max(0.0, min(quals) - spread_qual * 0.4)
        max_q = min(100.0, max(quals) + spread_qual * 0.4)

        def to_px(lat: float, q: float) -> tuple[float, float]:
            x = pl + (lat - min_lat) / (max_lat - min_lat) * pw
            y = pt + (1 - (q - min_q) / (max_q - min_q)) * ph
            return x, y

        parts: list[str] = [f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:520px;display:block">']

        for tick in range(4):
            gx = pl + tick / 3 * pw
            gy = pt + tick / 3 * ph
            parts.append(f'<line x1="{gx:.0f}" y1="{pt}" x2="{gx:.0f}" y2="{pt+ph}" stroke="#f1f5f9" stroke-width="1"/>')
            parts.append(f'<line x1="{pl}" y1="{gy:.0f}" x2="{pl+pw}" y2="{gy:.0f}" stroke="#f1f5f9" stroke-width="1"/>')

        parts.append(f'<line x1="{pl}" y1="{pt}" x2="{pl}" y2="{pt+ph}" stroke="#94a3b8" stroke-width="1.5"/>')
        parts.append(f'<line x1="{pl}" y1="{pt+ph}" x2="{pl+pw}" y2="{pt+ph}" stroke="#94a3b8" stroke-width="1.5"/>')
        parts.append(f'<text x="{pl + pw / 2:.0f}" y="{h - 8}" text-anchor="middle" font-size="11" fill="#475569" font-family="Helvetica,Arial,sans-serif">Latency (ms) — lower is faster →</text>')
        parts.append(f'<text x="13" y="{pt + ph / 2:.0f}" text-anchor="middle" font-size="11" fill="#475569" font-family="Helvetica,Arial,sans-serif" transform="rotate(-90,13,{pt + ph / 2:.0f})">Quality score ↑</text>')

        for tick in range(4):
            gx = pl + tick / 3 * pw
            lat_val = min_lat + tick / 3 * (max_lat - min_lat)
            parts.append(f'<text x="{gx:.0f}" y="{pt + ph + 16}" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">{lat_val:.0f}</text>')
            gy = pt + tick / 3 * ph
            q_val = max_q - tick / 3 * (max_q - min_q)
            parts.append(f'<text x="{pl - 6}" y="{gy + 4:.0f}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">{q_val:.0f}</text>')

        for ci, (name, lat, qual) in enumerate(data):
            px, py = to_px(lat, qual)
            color = palette[ci % len(palette)]
            label_dy = -14 if py > pt + 30 else 20
            parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="8" fill="{color}" fill-opacity="0.85"/>')
            parts.append(f'<text x="{px:.1f}" y="{py + label_dy:.1f}" text-anchor="middle" font-size="10" fill="{color}" font-weight="bold" font-family="Helvetica,Arial,sans-serif">{escape(name)}</text>')
            parts.append(f'<text x="{px:.1f}" y="{py + label_dy + 12:.1f}" text-anchor="middle" font-size="9" fill="#64748b" font-family="Helvetica,Arial,sans-serif">{lat}ms / q={qual:.1f}</text>')

        parts.append("</svg>")
        return "\n".join(parts)

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
            scores_by_candidate = []
            for name in candidate_names:
                scores = by_cat[cat].get(name, [])
                if scores:
                    avg = sum(scores) / len(scores)
                    scores_by_candidate.append(avg)
                    rows += f"<td>{avg:.1f}</td>"
                else:
                    scores_by_candidate.append(None)
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
