from datetime import datetime

from pydantic import BaseModel


class JudgeEvaluationCandidateRead(BaseModel):
    id: int
    candidate_response_id: int
    anonymized_candidate_label: str
    overall_score: str
    relevance_score: str
    accuracy_score: str
    completeness_score: str
    clarity_score: str
    instruction_following_score: str
    ranking_in_batch: int
    strengths_text: str | None
    weaknesses_text: str | None
    short_feedback: str | None
    detailed_feedback: str | None
    judge_confidence_score: str | None


class JudgeEvaluationRead(BaseModel):
    id: int
    judge_batch_id: int
    parsed_output_jsonb: str
    schema_version: str
    created_at: datetime
    candidates: list[JudgeEvaluationCandidateRead]


class JudgeBatchRead(BaseModel):
    id: int
    run_id: int
    prompt_snapshot_id: int
    judge_model_snapshot_id: int
    batch_type: str
    batch_index: int
    randomized_candidate_ids_jsonb: str
    request_payload_jsonb: str | None
    raw_response_text: str | None
    raw_response_jsonb: str | None
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    estimated_cost: str | None
    evaluation: JudgeEvaluationRead | None


class RunJudgingRead(BaseModel):
    run_id: int
    run_status: str
    total_batches: int
    completed_batches: int
    failed_batches: int
    running_batches: int
    pending_batches: int
    items: list[JudgeBatchRead]
