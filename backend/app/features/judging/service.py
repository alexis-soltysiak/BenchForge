from __future__ import annotations

import asyncio
import json
import os
import random
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session_factory
from app.core.encryption import decrypt_value
from app.features.aggregation.service import AggregationService
from app.features.execution.adapters.anthropic import AnthropicAdapter
from app.features.execution.adapters.base import (
    AdapterExecutionResult,
    BaseInferenceAdapter,
)
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
from app.features.runs.models import (
    CandidateResponse,
    SessionRun,
    SessionRunPromptSnapshot,
)

JUDGE_SCHEMA_VERSION = "mvp-v1"
ANONYMIZED_LABELS = ["A", "B", "C", "D", "E"]
ABSOLUTE_BATCH_TYPE = "absolute"
ARENA_BATCH_TYPE = "arena"
JUDGING_MAX_CONCURRENCY = max(
    1,
    int(os.getenv("BENCHFORGE_JUDGING_MAX_CONCURRENCY", "1")),
)
JUDGING_MAX_RETRIES = max(
    0,
    int(os.getenv("BENCHFORGE_JUDGING_MAX_RETRIES", "3")),
)
JUDGING_RETRY_BASE_DELAY_SECONDS = max(
    0.0,
    float(os.getenv("BENCHFORGE_JUDGING_RETRY_BASE_DELAY_SECONDS", "2.0")),
)
_JUDGING_RATE_LIMIT_LOCK = asyncio.Lock()
_JUDGING_LAST_REQUEST_AT: dict[str, float] = {}


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
        detailed_scores_jsonb=candidate.detailed_scores_jsonb,
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
        batch_type=batch.batch_type,
        batch_index=batch.batch_index,
        randomized_candidate_ids_jsonb=batch.randomized_candidate_ids_jsonb,
        request_payload_jsonb=batch.request_payload_jsonb,
        raw_response_text=batch.raw_response_text,
        raw_response_jsonb=batch.raw_response_jsonb,
        status=batch.status,
        started_at=batch.started_at,
        completed_at=batch.completed_at,
        error_message=batch.error_message,
        estimated_cost=batch.estimated_cost,
        evaluation=(
            serialize_judge_evaluation(batch.evaluation) if batch.evaluation else None
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

    async def start_judging(self, run_id: int) -> RunJudgingRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise JudgingError(f"Run {run_id} not found.")

        existing_batches = list(await self.repository.list_batches(run_id))
        if existing_batches:
            raise JudgingError(
                "Judging has already started for this run. Use retry judging instead."
            )

        return await self._run_judging(run)

    async def continue_judging(self, run_id: int) -> RunJudgingRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise JudgingError(f"Run {run_id} not found.")

        return await self._run_judging(run)

    async def retry_judging(self, run_id: int) -> RunJudgingRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise JudgingError(f"Run {run_id} not found.")

        batches = list(await self.repository.list_batches(run_id))
        retry_batch_ids: set[int] = set()
        for batch in batches:
            if batch.status == "failed" and not self._batch_has_judge_value(batch):
                batch.status = "pending"
                batch.error_message = None
                batch.completed_at = None
                retry_batch_ids.add(batch.id)

        if not retry_batch_ids:
            return self._serialize_run_judging(run, batches)

        run.status = "judging"
        await self.repository.commit()

        absolute_failed = await self._run_pending_batches(
            run,
            ABSOLUTE_BATCH_TYPE,
            allowed_batch_ids=retry_batch_ids,
        )

        if absolute_failed:
            run.status = "failed"
            await self.repository.commit()
        else:
            refreshed = list(await self.repository.list_batches(run.id))
            await self._ensure_arena_batches(run, refreshed)
            arena_failed = await self._run_pending_batches(
                run,
                ARENA_BATCH_TYPE,
                allowed_batch_ids=retry_batch_ids,
            )
            if arena_failed:
                run.status = "failed"
                await self.repository.commit()
            else:
                run.status = "aggregating"
                await self.repository.commit()
                await self._run_aggregation_stage(run.id)

        refreshed_batches = list(await self.repository.list_batches(run.id))
        return self._serialize_run_judging(run, refreshed_batches)

    async def clear_judging(self, run_id: int) -> RunJudgingRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise JudgingError(f"Run {run_id} not found.")

        await self.repository.clear_batches(run.id)
        await self.repository.clear_global_summaries(run.id)
        run.status = "ready_for_judging"
        run.report_status = "pending"
        run.html_report_path = None
        run.pdf_report_path = None
        await self.repository.commit()

        refreshed_run = await self.repository.get_run(run.id)
        if refreshed_run is None:
            raise JudgingError(f"Run {run_id} not found after clearing judging.")
        refreshed_batches = list(await self.repository.list_batches(run.id))
        return self._serialize_run_judging(refreshed_run, refreshed_batches)

    async def restart_judging(self, run_id: int) -> RunJudgingRead:
        await self.clear_judging(run_id)
        return await self.start_judging(run_id)

    async def retry_batch(self, run_id: int, batch_id: int) -> RunJudgingRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise JudgingError(f"Run {run_id} not found.")

        batch = await self.repository.get_batch(batch_id)
        if batch is None or batch.run_id != run_id:
            raise JudgingError(f"Judge batch {batch_id} not found for run {run_id}.")
        if self._batch_has_judge_value(batch):
            refreshed_batches = list(await self.repository.list_batches(run.id))
            return self._serialize_run_judging(run, refreshed_batches)

        batch.status = "pending"
        batch.error_message = None
        batch.completed_at = None
        run.status = "judging"
        await self.repository.commit()

        try:
            await self._execute_batch(run, batch)
        except (httpx.HTTPError, JudgingError, ValueError) as exc:
            batch.status = "failed"
            batch.completed_at = datetime.now(UTC)
            batch.error_message = str(exc)
            await self.repository.commit()
            refreshed_batches = list(await self.repository.list_batches(run.id))
            return self._serialize_run_judging(run, refreshed_batches)

        refreshed = list(await self.repository.list_batches(run.id))
        absolute_jobs_complete = all(
            item.status == "completed"
            for item in refreshed
            if item.batch_type == ABSOLUTE_BATCH_TYPE
        )
        if absolute_jobs_complete and batch.batch_type == ABSOLUTE_BATCH_TYPE:
            await self._ensure_arena_batches(run, refreshed)
            await self._run_pending_batches(run, ARENA_BATCH_TYPE)
            run.status = "aggregating"
            await self.repository.commit()
            await self._run_aggregation_stage(run.id)
        else:
            all_batches = list(await self.repository.list_batches(run.id))
            absolute_any_failed = any(
                item.status == "failed"
                for item in all_batches
                if item.batch_type == ABSOLUTE_BATCH_TYPE
            )
            all_absolute_complete = all(
                item.status == "completed"
                for item in all_batches
                if item.batch_type == ABSOLUTE_BATCH_TYPE
            )
            if all_absolute_complete:
                run.status = "aggregating"
                await self.repository.commit()
                await self._run_aggregation_stage(run.id)
            elif absolute_any_failed:
                run.status = "failed"
                await self.repository.commit()
            else:
                run.status = "judging"
                await self.repository.commit()

        refreshed_batches = list(await self.repository.list_batches(run.id))
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
            running_batches=sum(1 for item in batches if item.status == "running"),
            pending_batches=sum(1 for item in batches if item.status == "pending"),
            items=[serialize_judge_batch(item) for item in batches],
        )

    def _validate_run_ready_for_judging(self, run: SessionRun) -> None:
        candidate_snapshots = [
            item for item in run.model_snapshots if item.role == "candidate"
        ]
        judge_snapshots = [item for item in run.model_snapshots if item.role == "judge"]
        effective_candidate_responses = self._effective_candidate_responses(run)
        if not judge_snapshots:
            raise JudgingError("Run requires at least one judge snapshot.")
        if not run.prompt_snapshots or not candidate_snapshots:
            raise JudgingError(
                "Run must contain prompts and candidate snapshots before judging."
            )

        expected = len(run.prompt_snapshots) * len(candidate_snapshots)
        if len(effective_candidate_responses) != expected:
            raise JudgingError("Candidate response matrix is incomplete for judging.")
        incomplete = [
            item
            for item in effective_candidate_responses
            if item.status != "completed" or not item.normalized_response_text
        ]
        if incomplete:
            raise JudgingError(
                "All candidate responses must be completed before judging."
            )

    async def _run_judging(self, run: SessionRun) -> RunJudgingRead:
        self._validate_run_ready_for_judging(run)
        run.status = "judging"
        await self.repository.commit()
        await self._ensure_absolute_batches(run)
        absolute_failed = await self._run_pending_batches(run, ABSOLUTE_BATCH_TYPE)

        if absolute_failed:
            run.status = "failed"
            await self.repository.commit()
        else:
            batches = list(await self.repository.list_batches(run.id))
            await self._ensure_arena_batches(run, batches)
            await self._run_pending_batches(run, ARENA_BATCH_TYPE)
            run.status = "aggregating"
            await self.repository.commit()
            await self._run_aggregation_stage(run.id)

        refreshed_batches = list(await self.repository.list_batches(run.id))
        return self._serialize_run_judging(run, refreshed_batches)

    async def _run_pending_batches(
        self,
        run: SessionRun,
        batch_type: str,
        allowed_batch_ids: set[int] | None = None,
    ) -> bool:
        batches = [
            batch
            for batch in await self.repository.list_batches(run.id)
            if batch.batch_type == batch_type
        ]
        pending_batch_ids = [
            batch.id
            for batch in batches
            if batch.status != "completed"
            and not self._batch_has_judge_value(batch)
            and (allowed_batch_ids is None or batch.id in allowed_batch_ids)
        ]
        if not pending_batch_ids:
            return False

        semaphore = asyncio.Semaphore(
            min(JUDGING_MAX_CONCURRENCY, len(pending_batch_ids))
        )

        async def run_one(batch_id: int) -> str | None:
            async with semaphore:
                return await self._execute_batch_isolated(run.id, batch_id)

        results = await asyncio.gather(
            *(run_one(batch_id) for batch_id in pending_batch_ids)
        )
        return any(result is not None for result in results)

    async def _execute_batch_isolated(self, run_id: int, batch_id: int) -> str | None:
        session_factory = get_session_factory()
        async with session_factory() as session:
            service = JudgingService(session)
            run = await service.repository.get_run(run_id)
            if run is None:
                return f"Run {run_id} not found."

            batch = await service.repository.get_batch(batch_id)
            if batch is None or batch.run_id != run_id:
                return f"Judge batch {batch_id} not found for run {run_id}."

            if service._batch_has_judge_value(batch):
                return None

            try:
                await service._execute_batch(run, batch)
            except (httpx.HTTPError, JudgingError, ValueError) as exc:
                batch.status = "failed"
                batch.completed_at = datetime.now(UTC)
                batch.error_message = str(exc)
                await service.repository.commit()
                return str(exc)
        return None

    async def _ensure_absolute_batches(self, run: SessionRun) -> None:
        existing_signatures = {
            self._batch_signature(batch)
            for batch in await self.repository.list_batches(run.id)
        }
        judge_snapshots = sorted(
            [item for item in run.model_snapshots if item.role == "judge"],
            key=lambda item: item.id,
        )
        for judge_snapshot in judge_snapshots:
            for prompt_snapshot in sorted(
                run.prompt_snapshots,
                key=lambda item: item.snapshot_order,
            ):
                responses = self._responses_for_prompt(run, prompt_snapshot.id)
                for index, response in enumerate(responses, start=1):
                    candidate_ids = [response.id]
                    signature = (
                        ABSOLUTE_BATCH_TYPE,
                        prompt_snapshot.id,
                        judge_snapshot.id,
                        tuple(candidate_ids),
                    )
                    if signature in existing_signatures:
                        continue
                    batch = JudgeBatch(
                        run_id=run.id,
                        prompt_snapshot_id=prompt_snapshot.id,
                        judge_model_snapshot_id=judge_snapshot.id,
                        batch_type=ABSOLUTE_BATCH_TYPE,
                        batch_index=index,
                        randomized_candidate_ids_jsonb=json.dumps(candidate_ids),
                        status="pending",
                    )
                    self.repository.add_batch(batch)
                    existing_signatures.add(signature)
        await self.repository.commit()

    async def _ensure_arena_batches(
        self,
        run: SessionRun,
        batches: list[JudgeBatch],
    ) -> None:
        existing_signatures = {self._batch_signature(batch) for batch in batches}
        absolute_batches = [
            batch
            for batch in batches
            if batch.batch_type == ABSOLUTE_BATCH_TYPE
            and batch.status == "completed"
            and batch.evaluation is not None
        ]
        for judge_snapshot in sorted(
            [item for item in run.model_snapshots if item.role == "judge"],
            key=lambda item: item.id,
        ):
            for prompt_snapshot in sorted(
                run.prompt_snapshots,
                key=lambda item: item.snapshot_order,
            ):
                prompt_batches = [
                    batch
                    for batch in absolute_batches
                    if batch.prompt_snapshot_id == prompt_snapshot.id
                    and batch.judge_model_snapshot_id == judge_snapshot.id
                ]
                if len(prompt_batches) < 2:
                    continue

                pair_candidates = self._select_arena_pairs(prompt_batches)
                next_index = len(prompt_batches) + 1
                for pair in pair_candidates:
                    candidate_ids = self._shuffle_candidate_ids(
                        run.id,
                        prompt_snapshot.id,
                        judge_snapshot.id,
                        pair,
                        ARENA_BATCH_TYPE,
                    )
                    signature = (
                        ARENA_BATCH_TYPE,
                        prompt_snapshot.id,
                        judge_snapshot.id,
                        tuple(candidate_ids),
                    )
                    reverse_signature = (
                        ARENA_BATCH_TYPE,
                        prompt_snapshot.id,
                        judge_snapshot.id,
                        tuple(reversed(candidate_ids)),
                    )
                    if (
                        signature in existing_signatures
                        or reverse_signature in existing_signatures
                    ):
                        continue
                    batch = JudgeBatch(
                        run_id=run.id,
                        prompt_snapshot_id=prompt_snapshot.id,
                        judge_model_snapshot_id=judge_snapshot.id,
                        batch_type=ARENA_BATCH_TYPE,
                        batch_index=next_index,
                        randomized_candidate_ids_jsonb=json.dumps(candidate_ids),
                        status="pending",
                    )
                    self.repository.add_batch(batch)
                    existing_signatures.add(signature)
                    next_index += 1
        await self.repository.commit()

    def _select_arena_pairs(
        self, absolute_batches: list[JudgeBatch]
    ) -> list[tuple[int, int]]:
        scored = sorted(
            [
                (
                    batch.evaluation.candidates[0].candidate_response_id,
                    batch.evaluation.candidates[0].overall_score,
                )
                for batch in absolute_batches
                if batch.evaluation is not None and batch.evaluation.candidates
            ],
            key=lambda item: (item[1], item[0]),
            reverse=True,
        )
        if len(scored) < 2:
            return []

        top = scored[: min(3, len(scored))]
        pairs: list[tuple[int, int]] = []

        def append_pair(left_index: int, right_index: int) -> None:
            if right_index >= len(top):
                return
            left_id = top[left_index][0]
            right_id = top[right_index][0]
            if left_id == right_id:
                return
            pair = (min(left_id, right_id), max(left_id, right_id))
            if pair not in pairs:
                pairs.append(pair)

        append_pair(0, 1)
        if len(top) >= 3:
            append_pair(1, 2)
            if abs(top[0][1] - top[2][1]) <= Decimal("3.00"):
                append_pair(0, 2)
        return pairs

    def _batch_signature(
        self, batch: JudgeBatch
    ) -> tuple[str, int, int, tuple[int, ...]]:
        candidate_ids = json.loads(batch.randomized_candidate_ids_jsonb)
        return (
            batch.batch_type,
            batch.prompt_snapshot_id,
            batch.judge_model_snapshot_id,
            tuple(int(item) for item in candidate_ids),
        )

    def _shuffle_candidate_ids(
        self,
        run_id: int,
        prompt_snapshot_id: int,
        judge_model_snapshot_id: int,
        pair: tuple[int, int],
        batch_type: str,
    ) -> list[int]:
        randomized_candidate_ids = list(pair)
        random.Random(
            f"{run_id}:{prompt_snapshot_id}:{judge_model_snapshot_id}:{batch_type}:{pair[0]}:{pair[1]}"
        ).shuffle(randomized_candidate_ids)
        return randomized_candidate_ids

    async def _execute_batch(self, run: SessionRun, batch: JudgeBatch) -> None:
        if self._batch_has_judge_value(batch):
            return

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
            self._response_for_id(run.candidate_responses, int(candidate_id))
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
        await self.repository.commit()

        result = await self._generate_with_limits(
            adapter,
            model_profile,
            endpoint_url=judge_snapshot.endpoint_url,
            model_identifier=judge_snapshot.model_identifier,
            prompt_text=self._build_judge_prompt(
                batch.batch_type,
                prompt_snapshot,
                anonymized,
            ),
            system_prompt_text=self._build_judge_system_prompt(batch.batch_type),
            secret=secret,
            timeout_seconds=judge_snapshot.timeout_seconds,
            pricing_input_per_million=judge_snapshot.pricing_input_per_million,
            pricing_output_per_million=judge_snapshot.pricing_output_per_million,
        )
        batch.request_payload_jsonb = json.dumps(result.request_payload)
        batch.raw_response_text = result.raw_response_text
        batch.raw_response_jsonb = json.dumps(result.raw_response_json)
        batch.estimated_cost = (
            str(result.estimated_cost) if result.estimated_cost is not None else None
        )

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
        await self.repository.commit()

    def _batch_has_judge_value(self, batch: JudgeBatch) -> bool:
        return batch.status == "completed" or batch.evaluation is not None

    async def _generate_with_limits(
        self,
        adapter: BaseInferenceAdapter,
        model_profile: ModelProfile,
        **kwargs: Any,
    ) -> AdapterExecutionResult:
        for attempt in range(JUDGING_MAX_RETRIES + 1):
            await self._wait_for_provider_slot(model_profile)
            try:
                return await adapter.generate(**kwargs)
            except httpx.HTTPStatusError as exc:
                if (
                    not self._should_retry_http_error(exc)
                    or attempt >= JUDGING_MAX_RETRIES
                ):
                    raise
                await asyncio.sleep(self._retry_delay_seconds(exc, attempt))

        raise JudgingError("Judge model request exhausted retries.")

    async def _wait_for_provider_slot(self, model_profile: ModelProfile) -> None:
        delay_seconds = self._provider_request_delay_seconds(model_profile)
        if delay_seconds <= 0:
            return

        key = self._provider_rate_limit_key(model_profile)
        async with _JUDGING_RATE_LIMIT_LOCK:
            now = time.monotonic()
            elapsed = now - _JUDGING_LAST_REQUEST_AT.get(key, 0.0)
            wait_seconds = delay_seconds - elapsed
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)
            _JUDGING_LAST_REQUEST_AT[key] = time.monotonic()

    def _provider_request_delay_seconds(self, model_profile: ModelProfile) -> float:
        configured = os.getenv("BENCHFORGE_JUDGING_REQUEST_DELAY_SECONDS")
        if configured is not None:
            return max(0.0, float(configured))

        api_style = (model_profile.api_style or "").strip().lower()
        provider_type = (model_profile.provider_type or "").strip().lower()
        if api_style == "anthropic" or provider_type == "anthropic":
            return 1.0
        return 0.0

    def _provider_rate_limit_key(self, model_profile: ModelProfile) -> str:
        provider_type = (model_profile.provider_type or "").strip().lower()
        api_style = (model_profile.api_style or "").strip().lower()
        return provider_type or api_style or "default"

    def _should_retry_http_error(self, exc: httpx.HTTPStatusError) -> bool:
        status_code = exc.response.status_code
        return status_code == 429 or status_code in {500, 502, 503, 504}

    def _retry_delay_seconds(self, exc: httpx.HTTPStatusError, attempt: int) -> float:
        retry_after = exc.response.headers.get("retry-after")
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except ValueError:
                pass
        backoff = JUDGING_RETRY_BASE_DELAY_SECONDS * (2**attempt)
        return backoff + random.uniform(0.0, 0.25)

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
            detailed_scores_jsonb=candidate_payload.get("criterion_scores"),
            judge_confidence_score=(
                self._to_confidence(candidate_payload["confidence"])
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
                for item in self._effective_candidate_responses(run)
                if item.prompt_snapshot_id == prompt_snapshot_id
            ],
            key=lambda response: response.model_snapshot_id,
        )

    def _effective_candidate_responses(
        self, run: SessionRun
    ) -> list[CandidateResponse]:
        by_pair: dict[tuple[int, int], CandidateResponse] = {}

        for response in run.candidate_responses:
            key = (response.prompt_snapshot_id, response.model_snapshot_id)
            current = by_pair.get(key)
            if current is None or self._is_newer_candidate_response(response, current):
                by_pair[key] = response

        return list(by_pair.values())

    def _is_newer_candidate_response(
        self,
        candidate: CandidateResponse,
        current: CandidateResponse,
    ) -> bool:
        candidate_retry = candidate.retry_count or 0
        current_retry = current.retry_count or 0
        if candidate_retry != current_retry:
            return candidate_retry > current_retry

        candidate_timestamp = self._candidate_response_timestamp(candidate)
        current_timestamp = self._candidate_response_timestamp(current)
        if candidate_timestamp != current_timestamp:
            return candidate_timestamp > current_timestamp

        return candidate.id > current.id

    def _candidate_response_timestamp(self, response: CandidateResponse) -> datetime:
        return (
            response.completed_at
            or response.started_at
            or datetime.min.replace(tzinfo=UTC)
        )

    def _response_for_id(
        self,
        responses: list[CandidateResponse],
        candidate_response_id: int,
    ) -> CandidateResponse:
        return next(
            response for response in responses if response.id == candidate_response_id
        )

    def _build_judge_system_prompt(self, batch_type: str) -> str:
        if batch_type == ABSOLUTE_BATCH_TYPE:
            return (
                "You are a strict benchmark judge. Return JSON only. "
                "Evaluate a single candidate response on absolute merit against "
                "the prompt. "
                "Use a 0 to 100 scoring scale for every score field, never a "
                "1 to 10 scale. "
                "Use confidence on an integer scale from 1 to 5, where 1 means "
                "low confidence and 5 means very high confidence."
            )
        return (
            "You are a strict benchmark arena judge. Return JSON only. "
            "Compare the anonymized candidate responses head to head for the "
            "same benchmark prompt. "
            "Score each candidate from 0 to 100, never use a 1 to 10 scale, "
            "rank them, and use confidence on an integer scale from 1 to 5. "
            "Use 1 for near-ties and 5 for clear wins."
        )

    def _build_judge_prompt(
        self,
        batch_type: str,
        prompt_snapshot: SessionRunPromptSnapshot,
        anonymized: dict[str, CandidateResponse],
    ) -> str:
        candidates_block = "\n\n".join(
            [
                f"Candidate {label}:\n{response.normalized_response_text}"
                for label, response in anonymized.items()
            ]
        )
        evaluation_notes_block = (
            f"\n\nEvaluation notes:\n{prompt_snapshot.evaluation_notes}"
            if prompt_snapshot.evaluation_notes
            else ""
        )
        scenario_context_block = self._build_scenario_judge_context(prompt_snapshot)
        if batch_type == ABSOLUTE_BATCH_TYPE:
            return (
                "Evaluate the single anonymized candidate response for the "
                "benchmark prompt below."
                "\n\nBenchmark prompt:\n"
                f"{prompt_snapshot.user_prompt_text}"
                f"{evaluation_notes_block}"
                f"{scenario_context_block}"
                "\n\nCandidate:\n"
                f"{candidates_block}"
                "\n\nImportant rules:\n"
                "- Judge the response on absolute merit, not relative to "
                "imaginary alternatives.\n"
                "- Do not reward verbosity; concise complete answers should "
                "score higher than padded answers.\n"
                "- Penalize hallucinated facts, invented constraints, invented "
                "files, and claims unsupported by the prompt.\n"
                "- Verify every explicit constraint and the expected output "
                "format when provided.\n"
                "- Check must_include and must_not_include facts when provided.\n"
                "- Produce criterion_scores for scenario rubric criteria when "
                "a rubric is provided.\n"
                "- Every score must use the 0 to 100 scale, never 1 to 10.\n"
                "- confidence must be an integer from 1 to 5.\n"
                "\n\nReturn JSON with this exact shape:\n"
                "{"
                '"prompt_assessment":{"prompt_id":"string","batch_size":1,"candidates":[{"candidate_label":"A","overall_score":0,"relevance":0,"accuracy":0,"completeness":0,"clarity":0,"instruction_following":0,"criterion_scores":{"criterion_key":0},"ranking_in_batch":1,"strengths":[],"weaknesses":[],"short_feedback":"","detailed_feedback":"","confidence":1}]}}'
            )
        return (
            "Compare the anonymized candidate responses for the benchmark prompt below."
            "\n\nBenchmark prompt:\n"
            f"{prompt_snapshot.user_prompt_text}"
            f"{evaluation_notes_block}"
            f"{scenario_context_block}"
            "\n\nCandidates:\n"
            f"{candidates_block}"
            "\n\nImportant rules:\n"
            "- Rank the stronger response first.\n"
            "- Keep the top 3 ordering meaningful when more than two candidates "
            "are compared.\n"
            "- Score each response from 0 to 100 based on correctness, "
            "instruction following, completeness, clarity, and any "
            "scenario-specific rubric.\n"
            "- Do not reward verbosity; penalize padded answers that add no "
            "useful information.\n"
            "- Penalize hallucinated facts, invented constraints, invented "
            "files, and claims unsupported by the prompt.\n"
            "- Verify every explicit constraint, expected output format, "
            "must_include, and must_not_include item when provided.\n"
            "- Produce criterion_scores for scenario rubric criteria when a "
            "rubric is provided.\n"
            "- Never use a 1 to 10 scale for score fields.\n"
            "- confidence must be an integer from 1 to 5.\n"
            "\n\nReturn JSON with this exact shape:\n"
            "{"
            '"prompt_assessment":{"prompt_id":"string","batch_size":2,"candidates":[{"candidate_label":"A","overall_score":0,"relevance":0,"accuracy":0,"completeness":0,"clarity":0,"instruction_following":0,"criterion_scores":{"criterion_key":0},"ranking_in_batch":1,"strengths":[],"weaknesses":[],"short_feedback":"","detailed_feedback":"","confidence":1},{"candidate_label":"B","overall_score":0,"relevance":0,"accuracy":0,"completeness":0,"clarity":0,"instruction_following":0,"criterion_scores":{"criterion_key":0},"ranking_in_batch":2,"strengths":[],"weaknesses":[],"short_feedback":"","detailed_feedback":"","confidence":1}]}}'
        )

    def _build_scenario_judge_context(
        self,
        prompt_snapshot: SessionRunPromptSnapshot,
    ) -> str:
        context: dict[str, Any] = {}
        scenario_type = getattr(prompt_snapshot, "scenario_type", None)
        constraints = getattr(prompt_snapshot, "constraints_jsonb", None)
        expected_output_format = getattr(
            prompt_snapshot, "expected_output_format", None
        )
        gold_facts = getattr(prompt_snapshot, "gold_facts_jsonb", None)
        judge_rubric = getattr(prompt_snapshot, "judge_rubric_jsonb", None)
        if scenario_type:
            context["scenario_type"] = scenario_type
        if constraints:
            context["constraints"] = constraints
        if expected_output_format:
            context["expected_output_format"] = expected_output_format
        if gold_facts:
            context["gold_facts"] = gold_facts
        if judge_rubric:
            context["judge_rubric"] = judge_rubric
        if not context:
            return ""
        return "\n\nScenario evaluation context:\n" + json.dumps(
            context,
            ensure_ascii=False,
            indent=2,
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
        has_duplicate_ranking = False
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
            ranking_value = candidate.get("ranking_in_batch")
            if ranking_value is None:
                raise JudgingError("Candidate assessment is missing ranking_in_batch.")
            ranking = int(ranking_value)
            if ranking < 1 or ranking > len(anonymized):
                raise JudgingError("ranking_in_batch is out of bounds.")
            if ranking in rankings:
                has_duplicate_ranking = True
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
                    "criterion_scores": (
                        candidate.get("criterion_scores")
                        if isinstance(candidate.get("criterion_scores"), dict)
                        else None
                    ),
                    "confidence": (
                        self._normalize_confidence(candidate.get("confidence"))
                        if candidate.get("confidence") is not None
                        else None
                    ),
                }
            )

        if has_duplicate_ranking:
            sorted_by_score = sorted(
                normalized_candidates,
                key=lambda c: float(c["overall_score"]),
                reverse=True,
            )
            for rank, c in enumerate(sorted_by_score, start=1):
                c["ranking_in_batch"] = rank

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

    def _normalize_confidence(self, value: object) -> str:
        confidence = self._to_confidence(value)
        return format(confidence, "f")

    def _to_confidence(self, value: object) -> Decimal:
        try:
            confidence = Decimal(str(value))
        except Exception as exc:  # noqa: BLE001
            raise JudgingError(f"Invalid confidence value: {value!r}.") from exc
        if (
            confidence != confidence.to_integral_value()
            or confidence < 1
            or confidence > 5
        ):
            raise JudgingError("Judge confidence must be an integer between 1 and 5.")
        return confidence.quantize(Decimal("0.01"))

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
        if model_profile.api_style == "anthropic":
            return AnthropicAdapter()
        if model_profile.api_style == "openai_compatible":
            return OpenAICompatibleAdapter()
        if model_profile.provider_type.lower() == "huggingface":
            return HuggingFaceAdapter()
        return OpenAICompatibleAdapter()

    async def _run_aggregation_stage(self, run_id: int) -> None:
        aggregation_service = AggregationService(self.session)
        await aggregation_service.aggregate_run(run_id)
