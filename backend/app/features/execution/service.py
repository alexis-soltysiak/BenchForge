from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_value
from app.features.execution.adapters.base import BaseInferenceAdapter
from app.features.execution.adapters.huggingface import HuggingFaceAdapter
from app.features.execution.adapters.openai_compatible import OpenAICompatibleAdapter
from app.features.execution.repository import ExecutionRepository
from app.features.execution.schemas import (
    CandidateResponseListResponse,
    CandidateResponseMetricRead,
    CandidateResponseRead,
    LocalExecutionNextResponse,
    LocalExecutionPromptItem,
)
from app.features.judging.service import JudgingService
from app.features.models_registry.models import ModelProfile
from app.features.models_registry.repository import ModelProfileRepository
from app.features.runs.models import CandidateResponse, ResponseMetric, SessionRun, SessionRunModelSnapshot


class ExecutionError(ValueError):
    pass


class CandidateResponseNotFoundError(ValueError):
    pass


class LocalExecutionNotReadyError(ValueError):
    pass


def serialize_response_metric(metric: ResponseMetric | None) -> CandidateResponseMetricRead | None:
    if metric is None:
        return None
    return CandidateResponseMetricRead(
        duration_ms=metric.duration_ms,
        local_wait_ms=metric.local_wait_ms,
        input_tokens=metric.input_tokens,
        output_tokens=metric.output_tokens,
        total_tokens=metric.total_tokens,
        tokens_per_second=metric.tokens_per_second,
        estimated_cost=metric.estimated_cost,
        extra_metrics_jsonb=metric.extra_metrics_jsonb,
    )


def serialize_candidate_response(response: CandidateResponse) -> CandidateResponseRead:
    return CandidateResponseRead(
        id=response.id,
        run_id=response.run_id,
        prompt_snapshot_id=response.prompt_snapshot_id,
        model_snapshot_id=response.model_snapshot_id,
        status=response.status,
        request_payload_jsonb=response.request_payload_jsonb,
        raw_response_text=response.raw_response_text,
        normalized_response_text=response.normalized_response_text,
        raw_response_jsonb=response.raw_response_jsonb,
        started_at=response.started_at,
        completed_at=response.completed_at,
        retry_count=response.retry_count,
        error_message=response.error_message,
        metric=serialize_response_metric(response.metric),
    )


@dataclass
class ExecutionService:
    session: AsyncSession
    repository: ExecutionRepository = field(init=False)
    model_repository: ModelProfileRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = ExecutionRepository(self.session)
        self.model_repository = ModelProfileRepository(self.session)

    async def resume_run(self, run_id: int) -> CandidateResponseListResponse:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise ExecutionError(f"Run {run_id} not found.")

        run.status = "running_candidates"
        await self._ensure_candidate_response_rows(run)
        for response in run.candidate_responses:
            model_snapshot = next(
                item for item in run.model_snapshots if item.id == response.model_snapshot_id
            )
            if model_snapshot.role != "candidate":
                continue
            if model_snapshot.runtime_type != "remote":
                continue
            if response.status == "completed":
                continue
            await self._execute_remote_response(run, response, model_snapshot)

        if any(
            item.runtime_type == "local" and item.role == "candidate"
            for item in run.model_snapshots
        ):
            run.status = "waiting_local"
            await self.repository.commit()
        else:
            run.status = "judging"
            await self.repository.commit()
            await self._run_judging_stage(run.id)
        refreshed = await self.repository.list_candidate_responses(run.id)
        return CandidateResponseListResponse(
            items=[serialize_candidate_response(item) for item in refreshed],
            total=len(refreshed),
        )

    async def get_local_next(self, run_id: int) -> LocalExecutionNextResponse:
        run = await self._get_run_or_raise(run_id)
        await self._ensure_candidate_response_rows(run)
        local_model = self._find_next_local_model(run)
        if local_model is None:
            raise LocalExecutionNotReadyError("No pending local model remains for this run.")
        notes = self._load_notes(run.notes)
        current = notes.get("local_current") or {}
        responses = self._responses_for_model(run, local_model.id)
        prompt_map = {item.id: item for item in run.prompt_snapshots}
        return LocalExecutionNextResponse(
            run_id=run.id,
            model_snapshot_id=local_model.id,
            display_name=local_model.display_name,
            provider_type=local_model.provider_type,
            runtime_type=local_model.runtime_type,
            machine_label=local_model.machine_label,
            endpoint_url=local_model.endpoint_url,
            model_identifier=local_model.model_identifier,
            local_load_instructions=local_model.local_load_instructions,
            pending_prompt_count=len(
                [item for item in responses if item.status in {"pending", "failed"}]
            ),
            confirmed_ready=current.get("model_snapshot_id") == local_model.id,
            prompts=[
                LocalExecutionPromptItem(
                    prompt_snapshot_id=response.prompt_snapshot_id,
                    prompt_name=prompt_map[response.prompt_snapshot_id].name,
                    response_status=response.status,
                )
                for response in responses
            ],
        )

    async def confirm_local_ready(self, run_id: int) -> LocalExecutionNextResponse:
        run = await self._get_run_or_raise(run_id)
        await self._ensure_candidate_response_rows(run)
        local_model = self._find_next_local_model(run)
        if local_model is None:
            raise LocalExecutionNotReadyError("No pending local model remains for this run.")
        notes = self._load_notes(run.notes)
        notes["local_current"] = {
            "model_snapshot_id": local_model.id,
            "confirmed_at": datetime.now(UTC).isoformat(),
        }
        run.notes = json.dumps(notes)
        run.status = "waiting_local"
        await self.repository.commit()
        return await self.get_local_next(run_id)

    async def start_local_current(self, run_id: int) -> CandidateResponseListResponse:
        run = await self._get_run_or_raise(run_id)
        await self._ensure_candidate_response_rows(run)
        local_model = self._find_next_local_model(run)
        if local_model is None:
            raise LocalExecutionNotReadyError("No pending local model remains for this run.")

        notes = self._load_notes(run.notes)
        current = notes.get("local_current") or {}
        if current.get("model_snapshot_id") != local_model.id:
            raise LocalExecutionNotReadyError(
                "Current local model must be confirmed ready before execution starts."
            )
        confirmed_at = self._parse_datetime(current.get("confirmed_at"))

        run.status = "waiting_local"
        responses = self._responses_for_model(run, local_model.id)
        for response in responses:
            if response.status == "completed":
                continue
            await self._execute_remote_response(
                run=run,
                response=response,
                model_snapshot=local_model,
                local_confirmed_at=confirmed_at,
            )

        notes.pop("local_current", None)
        run.notes = json.dumps(notes) if notes else None
        if self._find_next_local_model(run) is not None:
            run.status = "waiting_local"
            await self.repository.commit()
        else:
            run.status = "judging"
            await self.repository.commit()
            await self._run_judging_stage(run.id)
        refreshed = await self.repository.list_candidate_responses(run.id)
        return CandidateResponseListResponse(
            items=[serialize_candidate_response(item) for item in refreshed],
            total=len(refreshed),
        )

    async def list_candidate_responses(self, run_id: int) -> CandidateResponseListResponse:
        responses = await self.repository.list_candidate_responses(run_id)
        return CandidateResponseListResponse(
            items=[serialize_candidate_response(item) for item in responses],
            total=len(responses),
        )

    async def get_candidate_response(self, response_id: int) -> CandidateResponseRead:
        response = await self.repository.get_candidate_response(response_id)
        if response is None:
            raise CandidateResponseNotFoundError(f"Candidate response {response_id} not found.")
        return serialize_candidate_response(response)

    async def _get_run_or_raise(self, run_id: int) -> SessionRun:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise ExecutionError(f"Run {run_id} not found.")
        return run

    async def _ensure_candidate_response_rows(self, run: SessionRun) -> None:
        existing_pairs = {
            (item.prompt_snapshot_id, item.model_snapshot_id) for item in run.candidate_responses
        }
        for prompt_snapshot in run.prompt_snapshots:
            for model_snapshot in run.model_snapshots:
                if model_snapshot.role != "candidate":
                    continue
                pair = (prompt_snapshot.id, model_snapshot.id)
                if pair in existing_pairs:
                    continue
                candidate_response = CandidateResponse(
                    run_id=run.id,
                    prompt_snapshot_id=prompt_snapshot.id,
                    model_snapshot_id=model_snapshot.id,
                    status="pending",
                )
                self.repository.add_candidate_response(candidate_response)
                run.candidate_responses.append(candidate_response)

    async def _execute_remote_response(
        self,
        run: SessionRun,
        response: CandidateResponse,
        model_snapshot: SessionRunModelSnapshot,
        local_confirmed_at: datetime | None = None,
    ) -> None:
        prompt_snapshot = next(
            item for item in run.prompt_snapshots if item.id == response.prompt_snapshot_id
        )
        model_profile = await self.model_repository.get_model_profile(
            model_snapshot.source_model_profile_id
        )
        if model_profile is None:
            response.status = "failed"
            response.error_message = "Source model profile not found."
            return

        adapter = self._resolve_adapter(model_profile)
        secret = (
            decrypt_value(model_profile.secret_encrypted)
            if model_profile.secret_encrypted
            else None
        )
        response.status = "running"
        response.started_at = datetime.now(UTC)
        response.error_message = None
        try:
            result = await adapter.generate(
                endpoint_url=model_snapshot.endpoint_url,
                model_identifier=model_snapshot.model_identifier,
                prompt_text=prompt_snapshot.user_prompt_text,
                system_prompt_text=prompt_snapshot.system_prompt_text,
                secret=secret,
                timeout_seconds=model_snapshot.timeout_seconds,
                pricing_input_per_million=model_snapshot.pricing_input_per_million,
                pricing_output_per_million=model_snapshot.pricing_output_per_million,
            )
            response.status = "completed"
            response.completed_at = datetime.now(UTC)
            response.retry_count += 1
            response.request_payload_jsonb = json.dumps(result.request_payload)
            response.raw_response_text = result.raw_response_text
            response.normalized_response_text = result.normalized_response_text
            response.raw_response_jsonb = json.dumps(result.raw_response_json)
            response.metric = ResponseMetric(
                duration_ms=result.duration_ms,
                local_wait_ms=(
                    int((response.started_at - local_confirmed_at).total_seconds() * 1000)
                    if local_confirmed_at is not None and response.started_at is not None
                    else None
                ),
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                total_tokens=result.total_tokens,
                tokens_per_second=(
                    str(result.tokens_per_second) if result.tokens_per_second is not None else None
                ),
                estimated_cost=(
                    str(result.estimated_cost) if result.estimated_cost is not None else None
                ),
                extra_metrics_jsonb=(
                    json.dumps(result.extra_metrics) if result.extra_metrics is not None else None
                ),
            )
        except httpx.HTTPError as exc:
            response.status = "failed"
            response.completed_at = datetime.now(UTC)
            response.retry_count += 1
            response.error_message = str(exc)
            response.metric = ResponseMetric(
                duration_ms=None,
                local_wait_ms=(
                    int((response.started_at - local_confirmed_at).total_seconds() * 1000)
                    if local_confirmed_at is not None and response.started_at is not None
                    else None
                ),
                input_tokens=None,
                output_tokens=None,
                total_tokens=None,
                tokens_per_second=None,
                estimated_cost=None,
                extra_metrics_jsonb=None,
            )

    def _resolve_adapter(self, model_profile: ModelProfile) -> BaseInferenceAdapter:
        if model_profile.api_style == "openai_compatible":
            return OpenAICompatibleAdapter()
        if model_profile.provider_type.lower() == "huggingface":
            return HuggingFaceAdapter()
        return OpenAICompatibleAdapter()

    def _find_next_local_model(self, run: SessionRun) -> SessionRunModelSnapshot | None:
        for model_snapshot in sorted(run.model_snapshots, key=lambda item: item.id):
            if model_snapshot.role != "candidate" or model_snapshot.runtime_type != "local":
                continue
            responses = self._responses_for_model(run, model_snapshot.id)
            if any(item.status in {"pending", "failed"} for item in responses):
                return model_snapshot
        return None

    def _responses_for_model(
        self,
        run: SessionRun,
        model_snapshot_id: int,
    ) -> list[CandidateResponse]:
        return [
            item
            for item in sorted(run.candidate_responses, key=lambda response: response.prompt_snapshot_id)
            if item.model_snapshot_id == model_snapshot_id
        ]

    def _load_notes(self, notes: str | None) -> dict[str, object]:
        if not notes:
            return {}
        try:
            loaded = json.loads(notes)
        except json.JSONDecodeError:
            return {}
        return loaded if isinstance(loaded, dict) else {}

    def _parse_datetime(self, value: object) -> datetime | None:
        if not isinstance(value, str):
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    async def _run_judging_stage(self, run_id: int) -> None:
        judging_service = JudgingService(self.session)
        await judging_service.retry_judging(run_id)
