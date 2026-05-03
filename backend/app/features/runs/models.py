from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import Base

if TYPE_CHECKING:
    from app.features.judging.models import JudgeBatch


class SessionRun(Base):
    __tablename__ = "session_run"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_session.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    launched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    rubric_version: Mapped[str] = mapped_column(String(64), nullable=False)
    report_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    html_report_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_report_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    prompt_snapshots: Mapped[list[SessionRunPromptSnapshot]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
    )
    model_snapshots: Mapped[list[SessionRunModelSnapshot]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
    )
    candidate_responses: Mapped[list[CandidateResponse]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
    )
    judge_batches: Mapped[list[JudgeBatch]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
    )
    global_summaries: Mapped[list[ModelGlobalSummary]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
    )


class SessionRunPromptSnapshot(Base):
    __tablename__ = "session_run_prompt_snapshot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("session_run.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_prompt_id: Mapped[int] = mapped_column(Integer, nullable=False)
    source_prompt_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category_name: Mapped[str] = mapped_column(String(120), nullable=False)
    system_prompt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    evaluation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    scenario_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_artifacts_jsonb: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    constraints_jsonb: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    expected_behavior_jsonb: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
    gold_facts_jsonb: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    judge_rubric_jsonb: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    estimated_input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expected_output_format: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_tier: Mapped[str | None] = mapped_column(String(32), nullable=True)
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    test_cases_visible_jsonb: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    test_cases_hidden_jsonb: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    snapshot_order: Mapped[int] = mapped_column(Integer, nullable=False)

    run: Mapped[SessionRun] = relationship(back_populates="prompt_snapshots")


class SessionRunModelSnapshot(Base):
    __tablename__ = "session_run_model_snapshot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("session_run.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_model_profile_id: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(64), nullable=False)
    api_style: Mapped[str] = mapped_column(String(64), nullable=False)
    runtime_type: Mapped[str] = mapped_column(String(32), nullable=False)
    machine_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    endpoint_url: Mapped[str] = mapped_column(String(500), nullable=False)
    model_identifier: Mapped[str] = mapped_column(String(255), nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    context_window: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricing_input_per_million: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
    )
    pricing_output_per_million: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
    )
    local_load_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped[SessionRun] = relationship(back_populates="model_snapshots")
    candidate_responses: Mapped[list[CandidateResponse]] = relationship(
        back_populates="model_snapshot"
    )
    global_summaries: Mapped[list[ModelGlobalSummary]] = relationship(
        back_populates="model_snapshot"
    )


class CandidateResponse(Base):
    __tablename__ = "candidate_response"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("session_run.id", ondelete="CASCADE"),
        nullable=False,
    )
    prompt_snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("session_run_prompt_snapshot.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("session_run_model_snapshot.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    request_payload_jsonb: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    normalized_response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response_jsonb: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    sample_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    execution_tier: Mapped[int | None] = mapped_column(Integer, nullable=True)

    run: Mapped[SessionRun] = relationship(back_populates="candidate_responses")
    model_snapshot: Mapped[SessionRunModelSnapshot] = relationship(
        back_populates="candidate_responses"
    )
    metric: Mapped[ResponseMetric | None] = relationship(
        back_populates="candidate_response",
        cascade="all, delete-orphan",
        uselist=False,
    )


class ResponseMetric(Base):
    __tablename__ = "response_metric"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_response_id: Mapped[int] = mapped_column(
        ForeignKey("candidate_response.id", ondelete="CASCADE"),
        nullable=False,
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    local_wait_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_per_second: Mapped[str | None] = mapped_column(String(32), nullable=True)
    estimated_cost: Mapped[str | None] = mapped_column(String(32), nullable=True)
    extra_metrics_jsonb: Mapped[str | None] = mapped_column(Text, nullable=True)

    candidate_response: Mapped[CandidateResponse] = relationship(
        back_populates="metric"
    )


class ModelGlobalSummary(Base):
    __tablename__ = "model_global_summary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("session_run.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("session_run_model_snapshot.id", ondelete="CASCADE"),
        nullable=False,
    )
    average_overall_score: Mapped[str] = mapped_column(String(32), nullable=False)
    average_relevance_score: Mapped[str] = mapped_column(String(32), nullable=False)
    average_accuracy_score: Mapped[str] = mapped_column(String(32), nullable=False)
    average_completeness_score: Mapped[str] = mapped_column(String(32), nullable=False)
    average_clarity_score: Mapped[str] = mapped_column(String(32), nullable=False)
    average_instruction_following_score: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )
    avg_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_tokens_per_second: Mapped[str | None] = mapped_column(String(32), nullable=True)
    total_estimated_cost: Mapped[str | None] = mapped_column(String(32), nullable=True)
    global_summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    best_patterns_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    weak_patterns_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_global_score: Mapped[str | None] = mapped_column(String(32), nullable=True)

    run: Mapped[SessionRun] = relationship(back_populates="global_summaries")
    model_snapshot: Mapped[SessionRunModelSnapshot] = relationship(
        back_populates="global_summaries"
    )
