from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import Base, CreatedAtMixin


class JudgeBatch(Base):
    __tablename__ = "judge_batch"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("session_run.id", ondelete="CASCADE"),
        nullable=False,
    )
    prompt_snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("session_run_prompt_snapshot.id", ondelete="CASCADE"),
        nullable=False,
    )
    judge_model_snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("session_run_model_snapshot.id", ondelete="CASCADE"),
        nullable=False,
    )
    batch_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="absolute",
        server_default="absolute",
    )
    batch_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default="1",
    )
    randomized_candidate_ids_jsonb: Mapped[str] = mapped_column(Text, nullable=False)
    request_payload_jsonb: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response_jsonb: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped["SessionRun"] = relationship(back_populates="judge_batches")
    evaluation: Mapped[JudgeEvaluation | None] = relationship(
        back_populates="judge_batch",
        cascade="all, delete-orphan",
        uselist=False,
    )


class JudgeEvaluation(Base, CreatedAtMixin):
    __tablename__ = "judge_evaluation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    judge_batch_id: Mapped[int] = mapped_column(
        ForeignKey("judge_batch.id", ondelete="CASCADE"),
        nullable=False,
    )
    parsed_output_jsonb: Mapped[str] = mapped_column(Text, nullable=False)
    schema_version: Mapped[str] = mapped_column(String(64), nullable=False)

    judge_batch: Mapped[JudgeBatch] = relationship(back_populates="evaluation")
    candidates: Mapped[list[JudgeEvaluationCandidate]] = relationship(
        back_populates="judge_evaluation",
        cascade="all, delete-orphan",
    )


class JudgeEvaluationCandidate(Base):
    __tablename__ = "judge_evaluation_candidate"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    judge_evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("judge_evaluation.id", ondelete="CASCADE"),
        nullable=False,
    )
    candidate_response_id: Mapped[int] = mapped_column(
        ForeignKey("candidate_response.id", ondelete="CASCADE"),
        nullable=False,
    )
    anonymized_candidate_label: Mapped[str] = mapped_column(String(16), nullable=False)
    overall_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    relevance_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    accuracy_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    completeness_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    clarity_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    instruction_following_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
    )
    ranking_in_batch: Mapped[int] = mapped_column(Integer, nullable=False)
    strengths_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    weaknesses_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    short_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    detailed_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    judge_confidence_score: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )

    judge_evaluation: Mapped[JudgeEvaluation] = relationship(
        back_populates="candidates"
    )
