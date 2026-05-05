from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import Base, TimestampMixin


class BenchmarkSession(Base, TimestampMixin):
    __tablename__ = "benchmark_session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="draft",
        server_default="draft",
    )
    max_candidates: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
        server_default="5",
    )
    rubric_version: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="mvp-v1",
        server_default="mvp-v1",
    )

    prompts: Mapped[list[BenchmarkSessionPrompt]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )
    candidates: Mapped[list[BenchmarkSessionCandidate]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )
    judges: Mapped[list[BenchmarkSessionJudge]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class BenchmarkSessionPrompt(Base):
    __tablename__ = "benchmark_session_prompt"
    __table_args__ = (
        UniqueConstraint("session_id", "prompt_id", name="uq_session_prompt_session_id_prompt_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_session.id", ondelete="CASCADE"),
        nullable=False,
    )
    prompt_id: Mapped[int] = mapped_column(
        ForeignKey("prompt.id", ondelete="RESTRICT"),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    sampling_mode: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="independent",
        server_default="independent",
    )

    session: Mapped[BenchmarkSession] = relationship(back_populates="prompts")


class BenchmarkSessionCandidate(Base):
    __tablename__ = "benchmark_session_candidate"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "model_profile_id",
            name="uq_session_candidate_session_id_model_profile_id",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_session.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_profile_id: Mapped[int] = mapped_column(
        ForeignKey("model_profile.id", ondelete="RESTRICT"),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped[BenchmarkSession] = relationship(back_populates="candidates")


class BenchmarkSessionJudge(Base):
    __tablename__ = "benchmark_session_judge"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "model_profile_id",
            name="uq_session_judge_session_id_model_profile_id",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("benchmark_session.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_profile_id: Mapped[int] = mapped_column(
        ForeignKey("model_profile.id", ondelete="RESTRICT"),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped[BenchmarkSession] = relationship(back_populates="judges")

