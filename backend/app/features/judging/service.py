from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_value
from app.features.aggregation.service import AggregationService
from app.features.execution.adapters.base import BaseInferenceAdapter
from app.features.execution.adapters.huggingface import HuggingFaceAdapter
from app.features.execution.adapters.openai_compatible import OpenAICompatibleAdapter
from app.features.judging.models import (
    JudgeBatch,
    JudgeEvaluation,
    JudgeEvaluationCandidate,
)
from app.features.judging.repository import JudgingRepository
from app.features.judging.schemas import (
    JudgeBatchRead,
    JudgeEvaluationCandidateRead,
    JudgeEvaluationRead,
    RunJudgingRead,
)
from app.features.models_registry.models import ModelProfile
from app.features.models_registry.repository import ModelProfileRepository
from app.features.runs.models import CandidateResponse, SessionRun

JUDGE_SCHEMA_VERSION = "mvp-v1"
ANONYMIZED_LABELS = ["A", "B", "C", "D", "E"]


class JudgingError(ValueError):
    pass


def serialize_judge_evaluation_candidate(
    candidate: JudgeEvaluationCandidate,
) -> JudgeEvaluationCandidateRead:
    return JudgeEvaluationCandidateRead(
        id=candidate.id,
        candidate_response_id=candidate.candidate_response_id,
        anonymized_candidate_label=candidate.anonymized_candidate_label,
        overall_score=str(candidate.overall_score),
        relevance_score=str(candidate.relevance_score),
        accuracy_score=str(candidate.accuracy_score),
        completeness_score=str(candidate.completeness_score),
        clarity_score=str(candidate.clarity_score),
        instruction_following_score=str(candidate.instruction_following_score),
        ranking_in_batch=candidate.ranking_in_batch,
        strengths_text=candidate.strengths_text,
        weaknesses_text=candidate.weaknesses_text,
        short_feedback=candidate.short_feedback,
        detailed_feedback=candidate.detailed_feedback,
        judge_confidence_score=(
            str(candidate.judge_confidence_score)
            if candidate.judge_confidence_score is not None
            else None
        ),
    )


def serialize_judge_evaluation(evaluation: JudgeEvaluation) -> JudgeEvaluationRead:
    return JudgeEvaluationRead(
        id=evaluation.id,
        judge_batch_id=evaluation.judge_batch_id,
        parsed_output_jsonb=evaluation.parsed_output_jsonb,
        schema_version=evaluation.schema_version,
        created_at=evaluation.created_at,
        candidates=[
            serialize_judge_evaluation_candidate(item)
            for item in sorted(
                evaluation.candidates,
                key=lambda candidate: candidate.ranking_in_batch,
            )
        ],
    )


def serialize_judge_batch(batch: JudgeBatch) -> JudgeBatchRead:
    return JudgeBatchRead(
        id=batch.id,
        run_id=batch.run_id,
        prompt_snapshot_id=batch.prompt_snapshot_id,
        judge_model_snapshot_id=batch.judge_model_snapshot_id,
        batch_index=batch.batch_index,
        randomized_candidate_ids_jsonb=batch.randomized_candidate_ids_jsonb,
        request_payload_jsonb=batch.request_payload_jsonb,
        raw_response_text=batch.raw_response_text,
        raw_response_jsonb=batch.raw_response_jsonb,
        status=batch.status,
        started_at=batch.started_at,
        completed_at=batch.completed_at,
        error_message=batch.error_message,
        evaluation=(
            serialize_judge_evaluation(batch.evaluation)
            if batch.evaluation
            else None
        ),
    )


@dataclass
class JudgingService:
    session: AsyncSession
    repository: JudgingRepository = field(init=False)
    model_repository: ModelProfileRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = JudgingRepository(self.session)
        self.model_repository = ModelProfileRepository(self.session)

    async def get_run_judging(self, run_id: int) -> RunJudgingRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise JudgingError(f"Run {run_id} not found.")
        batches = list(await self.repository.list_batches(run_id))
        return self._serialize_run_judging(run, batches)

    async def retry_judging(self, run_id: int) -> RunJudgingRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise JudgingError(f"Run {run_id} not found.")

        self._validate_run_ready_for_judging(run)
        batches = await self._ensure_batches(run)
        failed = False
        for batch in batches:
            if batch.status == "completed":
                continue
            try:
                await self._execute_batch(run, batch)
            except (httpx.HTTPError, JudgingError, ValueError) as exc:
                batch.status = "failed"
                batch.completed_at = datetime.now(UTC)
                batch.error_message = str(exc)
                failed = True

        if failed:
            run.status = "failed"
            await self.repository.commit()
        else:
            run.status = "aggregating"
            await self.repository.commit()
            await self._run_aggregation_stage(run_id)

        refreshed_batches = list(await self.repository.list_batches(run_id))
        return self._serialize_run_judging(run, refreshed_batches)

    def _serialize_run_judging(
        self,
        run: SessionRun,
        batches: list[JudgeBatch],
    ) -> RunJudgingRead:
        return RunJudgingRead(
            run_id=run.id,
            run_status=run.status,
            total_batches=len(batches),
            completed_batches=sum(1 for item in batches if item.status == "completed"),
            failed_batches=sum(1 for item in batches if item.status == "failed"),
            pending_batches=sum(1 for item in batches if item.status == "pending"),
            items=[serialize_judge_batch(item) for item in batches],
        )

    def _validate_run_ready_for_judging(self, run: SessionRun) -> None:
        candidate_snapshots = [
            item for item in run.model_snapshots if item.role == "candidate"
        ]
        judge_snapshots = [item for item in run.model_snapshots if item.role == "judge"]
        if len(judge_snapshots) != 1:
            raise JudgingError("MVP requires exactly one judge snapshot in the run.")
        if not run.prompt_snapshots or not candidate_snapshots:
            raise JudgingError(
                "Run must contain prompts and candidate snapshots before judging."
            )

        expected = len(run.prompt_snapshots) * len(candidate_snapshots)
        if len(run.candidate_responses) != expected:
            raise JudgingError("Candidate response matrix is incomplete for judging.")
        incomplete = [
            item
            for item in run.candidate_responses
            if item.status != "completed" or not item.normalized_response_text
        ]
        if incomplete:
            raise JudgingError(
                "All candidate responses must be completed before judging."
            )

    async def _ensure_batches(self, run: SessionRun) -> list[JudgeBatch]:
        existing = {
            (item.prompt_snapshot_id, item.batch_index): item
            for item in await self.repository.list_batches(run.id)
        }
        judge_snapshot = next(
            item for item in run.model_snapshots if item.role == "judge"
        )
        for prompt_snapshot in sorted(
            run.prompt_snapshots,
            key=lambda item: item.snapshot_order,
        ):
            key = (prompt_snapshot.id, 1)
            if key in existing:
                continue
            candidate_ids = [
                item.id
                for item in self._responses_for_prompt(run, prompt_snapshot.id)
            ]
            randomized_candidate_ids = list(candidate_ids)
            random.Random(f"{run.id}:{prompt_snapshot.id}:{judge_snapshot.id}").shuffle(
                randomized_candidate_ids
            )
            batch = JudgeBatch(
                run_id=run.id,
                prompt_snapshot_id=prompt_snapshot.id,
                judge_model_snapshot_id=judge_snapshot.id,
                batch_index=1,
                randomized_candidate_ids_jsonb=json.dumps(randomized_candidate_ids),
                status="pending",
            )
            self.repository.add_batch(batch)
            existing[key] = batch
        return [
            existing[(item.id, 1)]
            for item in sorted(
                run.prompt_snapshots,
                key=lambda prompt: prompt.snapshot_order,
            )
        ]

    async def _execute_batch(self, run: SessionRun, batch: JudgeBatch) -> None:
        judge_snapshot = next(
            item
            for item in run.model_snapshots
            if item.id == batch.judge_model_snapshot_id
        )
        model_profile = await self.model_repository.get_model_profile(
            judge_snapshot.source_model_profile_id
        )
        if model_profile is None:
            raise JudgingError("Source judge model profile not found.")

        candidate_ids = json.loads(batch.randomized_candidate_ids_jsonb)
        if not isinstance(candidate_ids, list) or not candidate_ids:
            raise JudgingError("Judge batch candidate ordering is invalid.")
        candidate_responses = [
            next(item for item in run.candidate_responses if item.id == candidate_id)
            for candidate_id in candidate_ids
        ]
        prompt_snapshot = next(
            item for item in run.prompt_snapshots if item.id == batch.prompt_snapshot_id
        )
        anonymized = {
            label: response
            for label, response in zip(
                ANONYMIZED_LABELS[: len(candidate_responses)],
                candidate_responses,
                strict=True,
            )
        }
        adapter = self._resolve_adapter(model_profile)
        secret = (
            decrypt_value(model_profile.secret_encrypted)
            if model_profile.secret_encrypted
            else None
        )

        batch.status = "running"
        batch.started_at = datetime.now(UTC)
        batch.completed_at = None
        batch.error_message = None

        result = await adapter.generate(
            endpoint_url=judge_snapshot.endpoint_url,
            model_identifier=judge_snapshot.model_identifier,
            prompt_text=self._build_judge_prompt(
                prompt_snapshot.user_prompt_text,
                prompt_snapshot.evaluation_notes,
                anonymized,
            ),
            system_prompt_text=self._build_judge_system_prompt(),
            secret=secret,
            timeout_seconds=judge_snapshot.timeout_seconds,
            pricing_input_per_million=judge_snapshot.pricing_input_per_million,
            pricing_output_per_million=judge_snapshot.pricing_output_per_million,
        )
        batch.request_payload_jsonb = json.dumps(result.request_payload)
        batch.raw_response_text = result.raw_response_text
        batch.raw_response_jsonb = json.dumps(result.raw_response_json)

        parsed_payload = self._parse_judge_output(
            result.normalized_response_text,
            anonymized,
        )
        batch.status = "completed"
        batch.completed_at = datetime.now(UTC)
        batch.error_message = None
        batch.evaluation = JudgeEvaluation(
            parsed_output_jsonb=json.dumps(parsed_payload),
            schema_version=JUDGE_SCHEMA_VERSION,
            candidates=[
                self._build_evaluation_candidate(candidate_payload, anonymized)
                for candidate_payload in parsed_payload["prompt_assessment"][
                    "candidates"
                ]
            ],
        )

    def _build_evaluation_candidate(
        self,
        candidate_payload: dict[str, Any],
        anonymized: dict[str, CandidateResponse],
    ) -> JudgeEvaluationCandidate:
        label = str(candidate_payload["candidate_label"])
        strengths = candidate_payload.get("strengths")
        weaknesses = candidate_payload.get("weaknesses")
        return JudgeEvaluationCandidate(
            candidate_response_id=anonymized[label].id,
            anonymized_candidate_label=label,
            overall_score=self._to_score(candidate_payload["overall_score"]),
            relevance_score=self._to_score(candidate_payload["relevance"]),
            accuracy_score=self._to_score(candidate_payload["accuracy"]),
            completeness_score=self._to_score(candidate_payload["completeness"]),
            clarity_score=self._to_score(candidate_payload["clarity"]),
            instruction_following_score=self._to_score(
                candidate_payload["instruction_following"]
            ),
            ranking_in_batch=int(candidate_payload["ranking_in_batch"]),
            strengths_text=self._join_feedback_list(strengths),
            weaknesses_text=self._join_feedback_list(weaknesses),
            short_feedback=self._optional_string(
                candidate_payload.get("short_feedback")
            ),
            detailed_feedback=self._optional_string(
                candidate_payload.get("detailed_feedback")
            ),
            judge_confidence_score=(
                self._to_score(candidate_payload["confidence"])
                if candidate_payload.get("confidence") is not None
                else None
            ),
        )

    def _responses_for_prompt(
        self,
        run: SessionRun,
        prompt_snapshot_id: int,
    ) -> list[CandidateResponse]:
        return sorted(
            [
                item
                for item in run.candidate_responses
                if item.prompt_snapshot_id == prompt_snapshot_id
            ],
            key=lambda response: response.model_snapshot_id,
        )

    def _build_judge_system_prompt(self) -> str:
        return (
            "You are a strict benchmark judge. Return JSON only. "
            "Score each candidate from 0 to 100 for relevance, accuracy, "
            "completeness, clarity, instruction_following, and overall_score. "
            "Include ranking_in_batch, strengths, "
            "weaknesses, short_feedback, detailed_feedback, and confidence."
        )

    def _build_judge_prompt(
        self,
        prompt_text: str,
        evaluation_notes: str | None,
        anonymized: dict[str, CandidateResponse],
    ) -> str:
        candidates_block = "\n\n".join(
            [
                f"Candidate {label}:\n{response.normalized_response_text}"
                for label, response in anonymized.items()
            ]
        )
        evaluation_notes_block = (
            f"\n\nEvaluation notes:\n{evaluation_notes}"
            if evaluation_notes
            else ""
        )
        return (
            "Evaluate the anonymized candidate responses for the benchmark "
            "prompt below."
            "\n\nBenchmark prompt:\n"
            f"{prompt_text}"
            f"{evaluation_notes_block}"
            "\n\nCandidates:\n"
            f"{candidates_block}"
            "\n\nReturn JSON with this exact shape:\n"
            '{'
            '"prompt_assessment":{"prompt_id":"string","batch_size":0,"candidates":[{"candidate_label":"A","overall_score":0,"relevance":0,"accuracy":0,"completeness":0,"clarity":0,"instruction_following":0,"ranking_in_batch":1,"strengths":[],"weaknesses":[],"short_feedback":"","detailed_feedback":"","confidence":0}]}}'
        )

    def _parse_judge_output(
        self,
        raw_text: str,
        anonymized: dict[str, CandidateResponse],
    ) -> dict[str, Any]:
        payload = json.loads(self._extract_json_text(raw_text))
        if not isinstance(payload, dict):
            raise JudgingError("Judge output must be a JSON object.")
        prompt_assessment = payload.get("prompt_assessment")
        if not isinstance(prompt_assessment, dict):
            raise JudgingError("Judge output is missing prompt_assessment.")
        candidates = prompt_assessment.get("candidates")
        if not isinstance(candidates, list):
            raise JudgingError("Judge output is missing candidate assessments.")
        if len(candidates) != len(anonymized):
            raise JudgingError(
                "Judge output candidate count does not match batch size."
            )

        labels = set(anonymized)
        seen_labels: set[str] = set()
        rankings: set[int] = set()
        normalized_candidates: list[dict[str, Any]] = []
        for candidate in candidates:
            if not isinstance(candidate, dict):
                raise JudgingError("Each candidate assessment must be an object.")
            label = str(candidate.get("candidate_label", "")).strip()
            if label not in labels:
                raise JudgingError(f"Unknown anonymized candidate label {label!r}.")
            if label in seen_labels:
                raise JudgingError(
                    f"Duplicate candidate label {label!r} in judge output."
                )
            ranking = int(candidate.get("ranking_in_batch"))
            if ranking < 1 or ranking > len(anonymized):
                raise JudgingError("ranking_in_batch is out of bounds.")
            if ranking in rankings:
                raise JudgingError("ranking_in_batch must be unique within a batch.")
            seen_labels.add(label)
            rankings.add(ranking)
            normalized_candidates.append(
                {
                    "candidate_label": label,
                    "overall_score": self._normalize_score(
                        candidate.get("overall_score")
                    ),
                    "relevance": self._normalize_score(candidate.get("relevance")),
                    "accuracy": self._normalize_score(candidate.get("accuracy")),
                    "completeness": self._normalize_score(
                        candidate.get("completeness")
                    ),
                    "clarity": self._normalize_score(candidate.get("clarity")),
                    "instruction_following": self._normalize_score(
                        candidate.get("instruction_following")
                    ),
                    "ranking_in_batch": ranking,
                    "strengths": self._normalize_feedback_list(
                        candidate.get("strengths")
                    ),
                    "weaknesses": self._normalize_feedback_list(
                        candidate.get("weaknesses")
                    ),
                    "short_feedback": self._optional_string(
                        candidate.get("short_feedback")
                    ),
                    "detailed_feedback": self._optional_string(
                        candidate.get("detailed_feedback")
                    ),
                    "confidence": (
                        self._normalize_score(candidate.get("confidence"))
                        if candidate.get("confidence") is not None
                        else None
                    ),
                }
            )

        return {
            "prompt_assessment": {
                "prompt_id": str(prompt_assessment.get("prompt_id") or ""),
                "batch_size": len(anonymized),
                "candidates": sorted(
                    normalized_candidates,
                    key=lambda candidate: candidate["ranking_in_batch"],
                ),
            }
        }

    def _extract_json_text(self, raw_text: str) -> str:
        stripped = raw_text.strip()
        if stripped.startswith("```"):
            lines = stripped.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            stripped = "\n".join(lines).strip()
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise JudgingError("Judge output does not contain a JSON object.")
        return stripped[start : end + 1]

    def _normalize_score(self, value: object) -> str:
        score = self._to_score(value)
        return format(score, "f")

    def _to_score(self, value: object) -> Decimal:
        try:
            score = Decimal(str(value))
        except Exception as exc:  # noqa: BLE001
            raise JudgingError(f"Invalid numeric score value: {value!r}.") from exc
        if score < 0 or score > 100:
            raise JudgingError("Judge scores must remain between 0 and 100.")
        return score.quantize(Decimal("0.01"))

    def _normalize_feedback_list(self, value: object) -> list[str]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise JudgingError("Judge feedback lists must be arrays.")
        return [str(item).strip() for item in value if str(item).strip()]

    def _join_feedback_list(self, value: object) -> str | None:
        if value is None:
            return None
        if isinstance(value, list):
            joined = "; ".join(str(item).strip() for item in value if str(item).strip())
            return joined or None
        return self._optional_string(value)

    def _optional_string(self, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _resolve_adapter(self, model_profile: ModelProfile) -> BaseInferenceAdapter:
        if model_profile.api_style == "openai_compatible":
            return OpenAICompatibleAdapter()
        if model_profile.provider_type.lower() == "huggingface":
            return HuggingFaceAdapter()
        return OpenAICompatibleAdapter()

    async def _run_aggregation_stage(self, run_id: int) -> None:
        aggregation_service = AggregationService(self.session)
        await aggregation_service.aggregate_run(run_id)
