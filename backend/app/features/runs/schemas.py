from datetime import datetime

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
    snapshot_order: int


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


class RunListResponse(BaseModel):
    items: list[RunListItem]
    total: int


class RunStatusRead(BaseModel):
    id: int
    status: str
    report_status: str
    launched_at: datetime
    completed_at: datetime | None
