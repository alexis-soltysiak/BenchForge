from datetime import datetime

from pydantic import BaseModel


class CandidateResponseMetricRead(BaseModel):
    duration_ms: int | None
    local_wait_ms: int | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    tokens_per_second: str | None
    estimated_cost: str | None
    extra_metrics_jsonb: str | None


class CandidateResponseRead(BaseModel):
    id: int
    run_id: int
    prompt_snapshot_id: int
    model_snapshot_id: int
    status: str
    request_payload_jsonb: str | None
    raw_response_text: str | None
    normalized_response_text: str | None
    raw_response_jsonb: str | None
    started_at: datetime | None
    completed_at: datetime | None
    retry_count: int
    error_message: str | None
    metric: CandidateResponseMetricRead | None
    execution_tier: int | None = None


class CandidateResponseListResponse(BaseModel):
    items: list[CandidateResponseRead]
    total: int


class LocalExecutionPromptItem(BaseModel):
    prompt_snapshot_id: int
    prompt_name: str
    response_status: str


class LocalExecutionNextResponse(BaseModel):
    run_id: int
    model_snapshot_id: int
    display_name: str
    provider_type: str
    runtime_type: str
    machine_label: str | None
    endpoint_url: str
    model_identifier: str
    local_load_instructions: str | None
    pending_prompt_count: int
    confirmed_ready: bool
    prompts: list[LocalExecutionPromptItem]
