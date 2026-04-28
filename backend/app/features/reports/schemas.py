from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ReportSummaryRowRead(BaseModel):
    model_snapshot_id: int
    candidate_name: str
    judge_score: str
    quality_score: str
    cost_score: str
    performance_score: str
    final_global_score: str | None
    avg_duration_ms: int | None = None
    total_estimated_cost: str | None = None


class ReportCandidateSectionRead(BaseModel):
    model_snapshot_id: int
    candidate_name: str
    provider_type: str
    runtime_type: str
    average_overall_score: str
    average_relevance_score: str
    average_accuracy_score: str
    average_completeness_score: str
    average_clarity_score: str
    average_instruction_following_score: str
    avg_duration_ms: int | None
    avg_total_tokens: int | None
    avg_tokens_per_second: str | None
    total_estimated_cost: str | None
    global_summary_text: str | None
    best_patterns_text: str | None
    weak_patterns_text: str | None
    final_global_score: str | None


class ReportPromptCandidateRead(BaseModel):
    candidate_name: str
    provider_type: str
    runtime_type: str
    response_status: str
    normalized_response_text: str | None
    duration_ms: int | None
    total_tokens: int | None
    estimated_cost: str | None
    overall_score: str | None
    ranking_in_batch: int | None
    short_feedback: str | None
    detailed_feedback: str | None
    strengths_text: str | None
    weaknesses_text: str | None
    detailed_scores_jsonb: dict[str, Any] | None = None


class ReportPromptSectionRead(BaseModel):
    prompt_snapshot_id: int
    prompt_name: str
    category_name: str
    system_prompt_text: str | None
    user_prompt_text: str
    evaluation_notes: str | None
    scenario_type: str | None = None
    constraints_jsonb: dict[str, Any] | list[Any] | None = None
    gold_facts_jsonb: dict[str, Any] | None = None
    judge_rubric_jsonb: dict[str, Any] | None = None
    expected_output_format: str | None = None
    cost_tier: str | None = None
    weight: int | None = None
    version: str | None = None
    candidates: list[ReportPromptCandidateRead]


class RunReportRead(BaseModel):
    run_id: int
    report_title: str
    benchmark_session_name: str
    launched_at: datetime
    judge_name: str
    prompt_count: int
    candidate_count: int
    summary_matrix: list[ReportSummaryRowRead]
    candidate_sections: list[ReportCandidateSectionRead]
    prompt_sections: list[ReportPromptSectionRead]


class ReportArtifactRead(BaseModel):
    run_id: int
    report_status: str
    html_report_path: str | None
    pdf_report_path: str | None
