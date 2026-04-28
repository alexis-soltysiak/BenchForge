from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_value
from app.features.execution.adapters.anthropic import AnthropicAdapter
from app.features.execution.adapters.base import AdapterExecutionResult, BaseInferenceAdapter
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
from app.features.models_registry.models import ModelProfile
from app.features.models_registry.repository import ModelProfileRepository
from app.features.runs.models import CandidateResponse, ResponseMetric, SessionRun, SessionRunModelSnapshot


class ExecutionError(ValueError):
    pass


class CandidateResponseNotFoundError(ValueError):
    pass


class LocalExecutionNotReadyError(ValueError):
    pass


class CandidateExecutionNotReadyError(ValueError):
    pass


@dataclass
class PreparedExecutionTask:
    response: CandidateResponse
    prompt_text: str
    system_prompt_text: str | None
    endpoint_url: str
    model_identifier: str
    timeout_seconds: int
    pricing_input_per_million: str | None
    pricing_output_per_million: str | None
    secret: str | None
    adapter: BaseInferenceAdapter
    local_confirmed_at: datetime | None = None
    started_at: datetime | None = None


@dataclass
class PreparedExecutionResult:
    response: CandidateResponse
    started_at: datetime
    completed_at: datetime
    local_confirmed_at: datetime | None
    result: AdapterExecutionResult | None = None
    error_message: str | None = None


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
        retry_count=response.retry_count or 0,
        error_message=response.error_message,
        metric=serialize_response_metric(response.metric),
    )


def format_http_error(exc: httpx.HTTPError, *, timeout_seconds: int | None = None) -> str:
    request = exc.request
    url = str(request.url) if request is not None else None
    method = request.method if request is not None else None
    location = (
        f"{method} {url}"
        if method and url
        else url
        if url
        else "request"
    )

    if isinstance(exc, httpx.TimeoutException):
        if timeout_seconds is not None:
            return f"Request timed out after {timeout_seconds}s while calling {location}."
        return f"Request timed out while calling {location}."
    if isinstance(exc, httpx.ConnectError):
        detail = str(exc).strip()
        if detail:
            return f"Connection error while calling {location}: {detail}"
        return f"Connection error while calling {location}."
    if isinstance(exc, httpx.HTTPStatusError):
        detail = exc.response.text.strip()
        if detail:
            return (
                f"HTTP {exc.response.status_code} returned by {location}: "
                f"{detail[:500]}"
            )
        return f"HTTP {exc.response.status_code} returned by {location}."

    detail = str(exc).strip()
    if detail:
        return f"{exc.__class__.__name__} while calling {location}: {detail}"
    return f"{exc.__class__.__name__} while calling {location}."


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

        await self._ensure_candidate_response_rows(run)
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
            task = await self._prepare_execution_task(
                run=run,
                response=response,
                model_snapshot=local_model,
                local_confirmed_at=confirmed_at,
            )
            await self._execute_prepared_tasks([task])

        notes.pop("local_current", None)
        run.notes = json.dumps(notes) if notes else None
        await self._advance_run_after_candidate_execution(run)
        refreshed = await self.repository.list_candidate_responses(run.id)
        return CandidateResponseListResponse(
            items=[serialize_candidate_response(item) for item in refreshed],
            total=len(refreshed),
        )

    async def start_remote_candidate(
        self,
        run_id: int,
        model_snapshot_id: int,
    ) -> CandidateResponseListResponse:
        run = await self._get_run_or_raise(run_id)
        await self._ensure_candidate_response_rows(run)
        model_snapshot = await self.repository.get_model_snapshot(run_id, model_snapshot_id)
        if model_snapshot is None or model_snapshot.role != "candidate":
            raise CandidateExecutionNotReadyError(
                f"Candidate model snapshot {model_snapshot_id} not found for this run."
            )
        if model_snapshot.runtime_type != "remote":
            raise CandidateExecutionNotReadyError(
                "Only endpoint candidates can be started with this action."
            )

        run.status = "running_candidates"
        responses = self._responses_for_model(run, model_snapshot.id)
        for response in responses:
            if response.status == "completed":
                continue
            task = await self._prepare_execution_task(run, response, model_snapshot)
            await self._execute_prepared_tasks([task])

        await self._advance_run_after_candidate_execution(run)
        refreshed = await self.repository.list_candidate_responses(run.id)
        return CandidateResponseListResponse(
            items=[serialize_candidate_response(item) for item in refreshed],
            total=len(refreshed),
        )

    async def retry_candidate_response(
        self,
        run_id: int,
        response_id: int,
    ) -> CandidateResponseRead:
        run = await self._get_run_or_raise(run_id)
        await self._ensure_candidate_response_rows(run)
        response = next((item for item in run.candidate_responses if item.id == response_id), None)
        if response is None:
            raise CandidateResponseNotFoundError(f"Candidate response {response_id} not found.")
        if response.status not in {"failed", "cancelled"}:
            raise CandidateExecutionNotReadyError("Only failed or cancelled responses can be retried.")

        model_snapshot = next(
            (item for item in run.model_snapshots if item.id == response.model_snapshot_id),
            None,
        )
        if model_snapshot is None:
            raise CandidateExecutionNotReadyError("Candidate model snapshot could not be resolved.")

        local_confirmed_at: datetime | None = None
        if model_snapshot.runtime_type == "local":
            next_local = self._find_next_local_model(run)
            if next_local is None or next_local.id != model_snapshot.id:
                raise CandidateExecutionNotReadyError(
                    "This local response can only be retried when the model is the active local handoff."
                )
            notes = self._load_notes(run.notes)
            current = notes.get("local_current") or {}
            current_model_snapshot_id = current.get("model_snapshot_id")
            if current_model_snapshot_id not in {None, model_snapshot.id}:
                raise CandidateExecutionNotReadyError(
                    "Confirm the active local model before retrying this response."
                )
            local_confirmed_at = self._parse_datetime(current.get("confirmed_at"))

        run.status = "running_candidates"
        task = await self._prepare_execution_task(
            run,
            response,
            model_snapshot,
            local_confirmed_at=local_confirmed_at,
        )
        await self._execute_prepared_tasks([task])
        await self._advance_run_after_candidate_execution(run)
        refreshed = await self.repository.get_candidate_response(response_id)
        if refreshed is None:
            raise CandidateResponseNotFoundError(f"Candidate response {response_id} not found.")
        return serialize_candidate_response(refreshed)

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

    async def _prepare_execution_task(
        self,
        run: SessionRun,
        response: CandidateResponse,
        model_snapshot: SessionRunModelSnapshot,
        local_confirmed_at: datetime | None = None,
    ) -> PreparedExecutionTask:
        prompt_snapshot = next(
            item for item in run.prompt_snapshots if item.id == response.prompt_snapshot_id
        )
        model_profile = await self.model_repository.get_model_profile(
            model_snapshot.source_model_profile_id
        )
        response.retry_count = response.retry_count or 0
        if model_profile is None:
            response.error_message = "Source model profile not found."
            return PreparedExecutionTask(
                response=response,
                prompt_text=prompt_snapshot.user_prompt_text,
                system_prompt_text=prompt_snapshot.system_prompt_text,
                endpoint_url=model_snapshot.endpoint_url,
                model_identifier=model_snapshot.model_identifier,
                timeout_seconds=model_snapshot.timeout_seconds,
                pricing_input_per_million=model_snapshot.pricing_input_per_million,
                pricing_output_per_million=model_snapshot.pricing_output_per_million,
                secret=None,
                adapter=OpenAICompatibleAdapter(),
                local_confirmed_at=local_confirmed_at,
            )

        adapter = self._resolve_adapter(model_profile)
        secret = (
            decrypt_value(model_profile.secret_encrypted)
            if model_profile.secret_encrypted
            else None
        )
        return PreparedExecutionTask(
            response=response,
            prompt_text=prompt_snapshot.user_prompt_text,
            system_prompt_text=prompt_snapshot.system_prompt_text,
            endpoint_url=model_snapshot.endpoint_url,
            model_identifier=model_snapshot.model_identifier,
            timeout_seconds=model_snapshot.timeout_seconds,
            pricing_input_per_million=model_snapshot.pricing_input_per_million,
            pricing_output_per_million=model_snapshot.pricing_output_per_million,
            secret=secret,
            adapter=adapter,
            local_confirmed_at=local_confirmed_at,
        )

    async def _execute_prepared_tasks(
        self,
        tasks: list[PreparedExecutionTask],
    ) -> None:
        if not tasks:
            return

        await self._mark_tasks_running(tasks)

        results = await asyncio.gather(
            *(self._run_prepared_task(task) for task in tasks),
        )
        for outcome in results:
            response = outcome.response
            response.completed_at = outcome.completed_at
            response.retry_count = (response.retry_count or 0) + 1
            if outcome.result is not None:
                response.status = "completed"
                response.error_message = None
                response.request_payload_jsonb = json.dumps(outcome.result.request_payload)
                response.raw_response_text = outcome.result.raw_response_text
                response.normalized_response_text = outcome.result.normalized_response_text
                response.raw_response_jsonb = json.dumps(outcome.result.raw_response_json)
                response.metric = ResponseMetric(
                    duration_ms=outcome.result.duration_ms,
                    local_wait_ms=(
                        int((outcome.started_at - outcome.local_confirmed_at).total_seconds() * 1000)
                        if outcome.local_confirmed_at is not None
                        else None
                    ),
                    input_tokens=outcome.result.input_tokens,
                    output_tokens=outcome.result.output_tokens,
                    total_tokens=outcome.result.total_tokens,
                    tokens_per_second=(
                        str(outcome.result.tokens_per_second)
                        if outcome.result.tokens_per_second is not None
                        else None
                    ),
                    estimated_cost=(
                        str(outcome.result.estimated_cost)
                        if outcome.result.estimated_cost is not None
                        else None
                    ),
                    extra_metrics_jsonb=(
                        json.dumps(outcome.result.extra_metrics)
                        if outcome.result.extra_metrics is not None
                        else None
                    ),
                )
            else:
                response.status = "failed"
                response.error_message = outcome.error_message or "Inference request failed."
                response.metric = ResponseMetric(
                    duration_ms=None,
                    local_wait_ms=(
                        int((outcome.started_at - outcome.local_confirmed_at).total_seconds() * 1000)
                        if outcome.local_confirmed_at is not None
                        else None
                    ),
                    input_tokens=None,
                    output_tokens=None,
                    total_tokens=None,
                    tokens_per_second=None,
                    estimated_cost=None,
                    extra_metrics_jsonb=None,
                )

    async def _mark_tasks_running(self, tasks: list[PreparedExecutionTask]) -> None:
        for task in tasks:
            started_at = datetime.now(UTC)
            task.started_at = started_at
            task.response.status = "running"
            task.response.started_at = started_at
            task.response.completed_at = None
            task.response.error_message = None

        await self.repository.commit()

    async def _advance_run_after_candidate_execution(self, run: SessionRun) -> None:
        if self._find_next_local_model(run) is not None:
            run.status = "waiting_local"
            await self.repository.commit()
            return

        candidate_responses = [
            item
            for item in run.candidate_responses
            if any(
                snapshot.id == item.model_snapshot_id and snapshot.role == "candidate"
                for snapshot in run.model_snapshots
            )
        ]
        if any(item.status in {"pending", "running", "failed", "cancelled"} for item in candidate_responses):
            run.status = "running_candidates"
            await self.repository.commit()
            return

        run.status = "ready_for_judging"
        await self.repository.commit()

    async def _run_prepared_task(
        self,
        task: PreparedExecutionTask,
    ) -> PreparedExecutionResult:
        response = task.response
        if response.error_message == "Source model profile not found.":
            started_at = datetime.now(UTC)
            response.status = "failed"
            response.started_at = started_at
            return PreparedExecutionResult(
                response=response,
                started_at=started_at,
                completed_at=started_at,
                local_confirmed_at=task.local_confirmed_at,
                error_message="Source model profile not found.",
            )

        started_at = task.started_at or datetime.now(UTC)
        try:
            result = await task.adapter.generate(
                endpoint_url=task.endpoint_url,
                model_identifier=task.model_identifier,
                prompt_text=task.prompt_text,
                system_prompt_text=task.system_prompt_text,
                secret=task.secret,
                timeout_seconds=task.timeout_seconds,
                pricing_input_per_million=task.pricing_input_per_million,
                pricing_output_per_million=task.pricing_output_per_million,
            )
            return PreparedExecutionResult(
                response=response,
                started_at=started_at,
                completed_at=datetime.now(UTC),
                local_confirmed_at=task.local_confirmed_at,
                result=result,
            )
        except httpx.HTTPError as exc:
            return PreparedExecutionResult(
                response=response,
                started_at=started_at,
                completed_at=datetime.now(UTC),
                local_confirmed_at=task.local_confirmed_at,
                error_message=format_http_error(exc, timeout_seconds=task.timeout_seconds),
            )

    def _resolve_adapter(self, model_profile: ModelProfile) -> BaseInferenceAdapter:
        if model_profile.api_style == "anthropic":
            return AnthropicAdapter()
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
