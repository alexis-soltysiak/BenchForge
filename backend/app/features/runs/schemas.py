from datetime import datetime
from typing import Any

from pydantic import BaseModel


class RunPromptSnapshotRead(BaseModel):
    id: int
    source_prompt_id: int
    source_prompt_updated_at: datetime | None
    name: str
    category_name: str
    system_prompt_text: str | None
    user_prompt_text: str
    evaluation_notes: str | None
    scenario_type: str | None = None
    objective: str | None = None
    context: str | None = None
    input_artifacts_jsonb: list[dict[str, Any]] | None = None
    constraints_jsonb: dict[str, Any] | list[Any] | None = None
    expected_behavior_jsonb: dict[str, Any] | list[Any] | None = None
    gold_facts_jsonb: dict[str, Any] | None = None
    judge_rubric_jsonb: dict[str, Any] | None = None
    estimated_input_tokens: int | None = None
    expected_output_format: str | None = None
    cost_tier: str | None = None
    weight: int | None = None
    version: str | None = None
    test_cases_visible_jsonb: list[dict[str, Any]] | None = None
    snapshot_order: int
    difficulty: int | None = None


class RunModelSnapshotRead(BaseModel):
    id: int
    source_model_profile_id: int
    role: str
    display_name: str
    provider_type: str
    api_style: str
    runtime_type: str
    machine_label: str | None
    endpoint_url: str
    model_identifier: str
    timeout_seconds: int
    context_window: int | None
    pricing_input_per_million: str | None
    pricing_output_per_million: str | None
    local_load_instructions: str | None


class RunGlobalSummaryRead(BaseModel):
    id: int
    model_snapshot_id: int
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


class DifficultyBreakdownRead(BaseModel):
    difficulty: int
    pass_1_rate: float
    prompt_count: int


class PassAtKSummaryRead(BaseModel):
    model_snapshot_id: int
    pass_1_rate: float
    pass_3_rate: float
    pass_5_rate: float
    code_gen_prompt_count: int
    difficulty_breakdown: list[DifficultyBreakdownRead] = []


class RunRead(BaseModel):
    id: int
    session_id: int
    name: str
    status: str
    launched_at: datetime
    completed_at: datetime | None
    rubric_version: str
    report_status: str
    html_report_path: str | None
    pdf_report_path: str | None
    notes: str | None
    prompt_snapshots: list[RunPromptSnapshotRead]
    model_snapshots: list[RunModelSnapshotRead]
    global_summaries: list[RunGlobalSummaryRead]
    candidate_response_count: int = 0
    pass_at_k_summaries: list[PassAtKSummaryRead] = []


class RunListItem(BaseModel):
    id: int
    session_id: int
    name: str
    status: str
    launched_at: datetime
    rubric_version: str
    report_status: str
    prompt_count: int
    model_count: int
    judge_count: int


class RunListResponse(BaseModel):
    items: list[RunListItem]
    total: int


class RunStatusRead(BaseModel):
    id: int
    status: str
    report_status: str
    launched_at: datetime
    completed_at: datetime | None
