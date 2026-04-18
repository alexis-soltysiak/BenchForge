from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
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
        self._render_pdf(report, pdf_output_path)

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
                quality_score=summary.average_overall_score,
                cost_score=str(cost_scores[summary.model_snapshot_id]),
                performance_score=str(performance_scores[summary.model_snapshot_id]),
                final_global_score=summary.final_global_score,
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
                if batch.evaluation is not None
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
        summary_rows = "".join(
            [
                (
                    "<tr>"
                    f"<td>{escape(row.candidate_name)}</td>"
                    f"<td>{escape(row.judge_score)}</td>"
                    f"<td>{escape(row.quality_score)}</td>"
                    f"<td>{escape(row.cost_score)}</td>"
                    f"<td>{escape(row.performance_score)}</td>"
                    f"<td>{escape(row.final_global_score or '—')}</td>"
                    "</tr>"
                )
                for row in report.summary_matrix
            ]
        )
        candidate_sections = "".join(
            [
                (
                    "<section class='candidate'>"
                    f"<h3>{escape(section.candidate_name)}</h3>"
                    f"<p>{escape(section.provider_type)} / "
                    f"{escape(section.runtime_type)}</p>"
                    f"<p><strong>Global score:</strong> "
                    f"{escape(section.final_global_score or '—')}</p>"
                    f"<p>{escape(
                        section.global_summary_text or 'No summary available.'
                    )}</p>"
                    f"<p><strong>Best patterns:</strong> "
                    f"{escape(section.best_patterns_text or '—')}</p>"
                    f"<p><strong>Weak patterns:</strong> "
                    f"{escape(section.weak_patterns_text or '—')}</p>"
                    "</section>"
                )
                for section in report.candidate_sections
            ]
        )
        prompt_sections = "".join(
            [
                (
                    "<section class='prompt'>"
                    f"<h3>{escape(section.prompt_name)}</h3>"
                    f"<p><strong>Category:</strong> {escape(section.category_name)}</p>"
                    f"<pre>{escape(section.user_prompt_text)}</pre>"
                    + "".join(
                        [
                            (
                                "<article class='response'>"
                                f"<h4>{escape(candidate.candidate_name)}</h4>"
                                f"<p><strong>Rank:</strong> "
                                f"{escape(str(candidate.ranking_in_batch or '—'))}</p>"
                                f"<p><strong>Judge score:</strong> "
                                f"{escape(candidate.overall_score or '—')}</p>"
                                f"<pre>{escape(
                                    candidate.normalized_response_text or 'No response'
                                )}</pre>"
                                f"<p>{escape(
                                    candidate.short_feedback or 'No short feedback'
                                )}</p>"
                                f"<p>{escape(
                                    candidate.detailed_feedback
                                    or 'No detailed feedback'
                                )}</p>"
                                "</article>"
                            )
                            for candidate in section.candidates
                        ]
                    )
                    + "</section>"
                )
                for section in report.prompt_sections
            ]
        )
        return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(report.report_title)}</title>
    <style>
      :root {{
        color-scheme: light;
        --ink: #0f172a;
        --muted: #475569;
        --line: #dbe4ee;
        --panel: #f8fafc;
        --accent: #0f766e;
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        padding: 32px;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background: white;
        line-height: 1.5;
      }}
      h1, h2, h3, h4 {{ margin: 0 0 12px; }}
      .hero {{
        border-bottom: 2px solid var(--line);
        padding-bottom: 20px;
        margin-bottom: 28px;
      }}
      .meta {{
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 16px;
      }}
      .meta div, .candidate, .prompt, .response {{
        border: 1px solid var(--line);
        background: var(--panel);
        padding: 16px;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        margin: 18px 0 28px;
      }}
      th, td {{
        border: 1px solid var(--line);
        padding: 10px 12px;
        text-align: left;
      }}
      th {{
        background: #eef6f6;
      }}
      .candidate-grid, .prompt-grid {{
        display: grid;
        gap: 18px;
      }}
      .prompt-grid {{
        page-break-before: always;
      }}
      pre {{
        white-space: pre-wrap;
        word-break: break-word;
        background: white;
        border: 1px solid var(--line);
        padding: 12px;
      }}
      @media print {{
        body {{ padding: 0; }}
        .prompt {{ page-break-inside: avoid; }}
      }}
    </style>
  </head>
  <body>
    <section class="hero">
      <h1>{escape(report.report_title)}</h1>
      <p>{escape(report.benchmark_session_name)}</p>
      <div class="meta">
        <div>
          <strong>Run timestamp:</strong> {escape(report.launched_at.isoformat())}
        </div>
        <div><strong>Judge used:</strong> {escape(report.judge_name)}</div>
        <div><strong>Prompt count:</strong> {report.prompt_count}</div>
        <div><strong>Candidate count:</strong> {report.candidate_count}</div>
      </div>
    </section>
    <section>
      <h2>Executive Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Judge score</th>
            <th>Quality score</th>
            <th>Cost score</th>
            <th>Performance score</th>
            <th>Final global score</th>
          </tr>
        </thead>
        <tbody>{summary_rows}</tbody>
      </table>
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

    def _render_pdf(self, report: RunReportRead, output_path: Path) -> None:
        styles = getSampleStyleSheet()
        styles.add(
            ParagraphStyle(
                name="BenchBody",
                parent=styles["BodyText"],
                fontName="Helvetica",
                fontSize=10,
                leading=14,
                spaceAfter=8,
            )
        )
        story = [
            Paragraph(report.report_title, styles["Title"]),
            Paragraph(report.benchmark_session_name, styles["Heading2"]),
            Paragraph(
                (
                    f"Run timestamp: {escape(report.launched_at.isoformat())}<br/>"
                    f"Judge used: {escape(report.judge_name)}<br/>"
                    f"Prompt count: {report.prompt_count}<br/>"
                    f"Candidate count: {report.candidate_count}"
                ),
                styles["BenchBody"],
            ),
            Spacer(1, 8),
            Paragraph("Executive Summary", styles["Heading2"]),
            self._build_summary_table(report),
            Spacer(1, 10),
            Paragraph("Candidate Sections", styles["Heading2"]),
        ]

        for section in report.candidate_sections:
            story.extend(
                [
                    Paragraph(section.candidate_name, styles["Heading3"]),
                    Paragraph(
                        f"{section.provider_type} / {section.runtime_type}",
                        styles["BenchBody"],
                    ),
                    Paragraph(
                        (
                            f"Global score: {section.final_global_score or '—'}<br/>"
                            "Average overall score: "
                            f"{section.average_overall_score}<br/>"
                            f"Average latency: {section.avg_duration_ms or '—'} ms<br/>"
                            f"Average total tokens: {section.avg_total_tokens or '—'}"
                        ),
                        styles["BenchBody"],
                    ),
                    Paragraph(
                        section.global_summary_text or "No global summary available.",
                        styles["BenchBody"],
                    ),
                    Paragraph(
                        f"Best patterns: {section.best_patterns_text or '—'}",
                        styles["BenchBody"],
                    ),
                    Paragraph(
                        f"Weak patterns: {section.weak_patterns_text or '—'}",
                        styles["BenchBody"],
                    ),
                    Spacer(1, 10),
                ]
            )

        story.append(PageBreak())
        story.append(Paragraph("Prompt Sections", styles["Heading2"]))
        pre_style = ParagraphStyle(
            "PromptMono",
            parent=styles["Code"],
            fontName="Courier",
            fontSize=8.5,
            leading=11,
        )
        for section in report.prompt_sections:
            story.extend(
                [
                    Paragraph(section.prompt_name, styles["Heading3"]),
                    Paragraph(
                        f"Category: {section.category_name}",
                        styles["BenchBody"],
                    ),
                    Preformatted(section.user_prompt_text, pre_style),
                ]
            )
            if section.evaluation_notes:
                story.append(
                    Paragraph(
                        f"Evaluation notes: {section.evaluation_notes}",
                        styles["BenchBody"],
                    )
                )

            for candidate in section.candidates:
                story.extend(
                    [
                        Paragraph(candidate.candidate_name, styles["Heading4"]),
                        Paragraph(
                            (
                                f"Rank: {candidate.ranking_in_batch or '—'}<br/>"
                                f"Judge score: {candidate.overall_score or '—'}<br/>"
                                f"Duration: {candidate.duration_ms or '—'} ms<br/>"
                                f"Tokens: {candidate.total_tokens or '—'}<br/>"
                                f"Cost: {candidate.estimated_cost or '—'}"
                            ),
                            styles["BenchBody"],
                        ),
                        Preformatted(
                            candidate.normalized_response_text or "No response",
                            pre_style,
                        ),
                        Paragraph(
                            candidate.short_feedback or "No short feedback",
                            styles["BenchBody"],
                        ),
                        Paragraph(
                            candidate.detailed_feedback or "No detailed feedback",
                            styles["BenchBody"],
                        ),
                        Spacer(1, 8),
                    ]
                )
            story.append(Spacer(1, 12))

        document = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
            title=report.report_title,
        )
        document.build(story)

    def _build_summary_table(self, report: RunReportRead) -> Table:
        data = [
            [
                "Candidate",
                "Judge",
                "Quality",
                "Cost",
                "Performance",
                "Global",
            ],
            *[
                [
                    row.candidate_name,
                    row.judge_score,
                    row.quality_score,
                    row.cost_score,
                    row.performance_score,
                    row.final_global_score or "—",
                ]
                for row in report.summary_matrix
            ],
        ]
        table = Table(
            data,
            repeatRows=1,
            colWidths=[44 * mm, 20 * mm, 20 * mm, 20 * mm, 28 * mm, 20 * mm],
        )
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f4f1")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("LEADING", (0, 0), (-1, -1), 11),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f8fafc")],
                    ),
                ]
            )
        )
        return table
