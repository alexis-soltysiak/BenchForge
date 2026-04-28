from types import SimpleNamespace

import httpx
import pytest

from app.features.execution.adapters.anthropic import AnthropicAdapter
from app.features.execution.service import (
    ExecutionService,
    LocalExecutionNotReadyError,
    format_http_error,
)
from app.features.runs.models import CandidateResponse, SessionRunModelSnapshot


@pytest.mark.asyncio
async def test_resume_run_requires_existing_run() -> None:
    service = ExecutionService(SimpleNamespace())

    class Repository:
        async def get_run(self, run_id: int):
            return None

    service.repository = Repository()  # type: ignore[assignment]

    with pytest.raises(ValueError):
        await service.resume_run(1)


@pytest.mark.asyncio
async def test_ensure_candidate_response_rows_creates_matrix() -> None:
    service = ExecutionService(SimpleNamespace())
    created: list[CandidateResponse] = []

    class Repository:
        def add_candidate_response(self, candidate_response: CandidateResponse) -> None:
            created.append(candidate_response)

    service.repository = Repository()  # type: ignore[assignment]

    run = SimpleNamespace(
        id=1,
        prompt_snapshots=[SimpleNamespace(id=10), SimpleNamespace(id=11)],
        model_snapshots=[
            SimpleNamespace(id=20, role="candidate"),
            SimpleNamespace(id=21, role="judge"),
        ],
        candidate_responses=[],
    )

    await service._ensure_candidate_response_rows(run)

    assert len(created) == 2
    assert {(item.prompt_snapshot_id, item.model_snapshot_id) for item in created} == {
        (10, 20),
        (11, 20),
    }


@pytest.mark.asyncio
async def test_get_local_next_raises_when_no_local_model_left() -> None:
    service = ExecutionService(SimpleNamespace())

    class Repository:
        async def get_run(self, run_id: int):
            return SimpleNamespace(
                id=run_id,
                prompt_snapshots=[],
                model_snapshots=[],
                candidate_responses=[],
                notes=None,
            )

        async def commit(self) -> None:
            return None

    service.repository = Repository()  # type: ignore[assignment]

    with pytest.raises(LocalExecutionNotReadyError):
        await service.get_local_next(1)


@pytest.mark.asyncio
async def test_retry_local_candidate_response_allows_missing_current_confirmation() -> None:
    service = ExecutionService(SimpleNamespace())

    response = CandidateResponse(
        id=37,
        run_id=3,
        prompt_snapshot_id=11,
        model_snapshot_id=22,
        status="failed",
        retry_count=1,
    )
    model_snapshot = SessionRunModelSnapshot(
        id=22,
        run_id=3,
        source_model_profile_id=7,
        role="candidate",
        display_name="Qwen 3.6 35B A3B - LM Studio Local",
        provider_type="lmstudio",
        api_style="openai_compatible",
        runtime_type="local",
        machine_label=None,
        endpoint_url="http://localhost:1234/v1",
        model_identifier="qwen-local",
        timeout_seconds=60,
        context_window=None,
        pricing_input_per_million=None,
        pricing_output_per_million=None,
        local_load_instructions=None,
    )
    run = SimpleNamespace(
        id=3,
        status="waiting_local",
        notes=None,
        prompt_snapshots=[],
        model_snapshots=[model_snapshot],
        candidate_responses=[response],
    )

    class Repository:
        async def get_run(self, run_id: int):
            assert run_id == 3
            return run

        async def get_candidate_response(self, response_id: int):
            assert response_id == 37
            return response

    service.repository = Repository()  # type: ignore[assignment]

    async def fake_prepare_execution_task(*args, **kwargs):
        return SimpleNamespace()

    async def fake_execute_prepared_tasks(tasks):
        response.status = "completed"

    async def fake_advance_run_after_candidate_execution(run_arg):
        return None

    service._prepare_execution_task = fake_prepare_execution_task  # type: ignore[method-assign]
    service._execute_prepared_tasks = fake_execute_prepared_tasks  # type: ignore[method-assign]
    service._advance_run_after_candidate_execution = fake_advance_run_after_candidate_execution  # type: ignore[method-assign]

    payload = await service.retry_candidate_response(3, 37)

    assert payload.id == 37
    assert payload.status == "completed"


@pytest.mark.asyncio
async def test_start_remote_candidate_only_executes_selected_model() -> None:
    service = ExecutionService(SimpleNamespace())
    selected_response = SimpleNamespace(
        id=101,
        run_id=5,
        prompt_snapshot_id=11,
        model_snapshot_id=21,
        status="pending",
        request_payload_jsonb=None,
        raw_response_text=None,
        normalized_response_text=None,
        raw_response_jsonb=None,
        started_at=None,
        completed_at=None,
        retry_count=0,
        error_message=None,
        metric=None,
    )
    other_response = SimpleNamespace(
        id=102,
        run_id=5,
        prompt_snapshot_id=11,
        model_snapshot_id=22,
        status="pending",
        request_payload_jsonb=None,
        raw_response_text=None,
        normalized_response_text=None,
        raw_response_jsonb=None,
        started_at=None,
        completed_at=None,
        retry_count=0,
        error_message=None,
        metric=None,
    )
    selected_model = SimpleNamespace(
        id=21,
        run_id=5,
        source_model_profile_id=201,
        role="candidate",
        display_name="Selected",
        provider_type="openai",
        api_style="openai_compatible",
        runtime_type="remote",
        machine_label=None,
        endpoint_url="https://selected.test",
        model_identifier="selected",
        timeout_seconds=60,
        context_window=None,
        pricing_input_per_million=None,
        pricing_output_per_million=None,
        local_load_instructions=None,
    )
    other_model = SimpleNamespace(
        id=22,
        run_id=5,
        source_model_profile_id=202,
        role="candidate",
        display_name="Other",
        provider_type="openai",
        api_style="openai_compatible",
        runtime_type="remote",
        machine_label=None,
        endpoint_url="https://other.test",
        model_identifier="other",
        timeout_seconds=60,
        context_window=None,
        pricing_input_per_million=None,
        pricing_output_per_million=None,
        local_load_instructions=None,
    )
    run = SimpleNamespace(
        id=5,
        status="pending",
        prompt_snapshots=[SimpleNamespace(id=11)],
        model_snapshots=[selected_model, other_model],
        candidate_responses=[selected_response, other_response],
    )
    executed_response_ids: list[int] = []

    class Repository:
        async def get_run(self, run_id: int):
            return run

        async def get_model_snapshot(self, run_id: int, model_snapshot_id: int):
            return next(
                item for item in run.model_snapshots if item.id == model_snapshot_id
            )

        async def list_candidate_responses(self, run_id: int):
            return run.candidate_responses

    async def fake_prepare_execution_task(run_arg, response, model_snapshot):
        return SimpleNamespace(response=response)

    async def fake_execute_prepared_tasks(tasks):
        for task in tasks:
            executed_response_ids.append(task.response.id)
            task.response.status = "completed"

    async def fake_advance_run_after_candidate_execution(run_arg):
        return None

    service.repository = Repository()  # type: ignore[assignment]
    service._prepare_execution_task = fake_prepare_execution_task  # type: ignore[method-assign]
    service._execute_prepared_tasks = fake_execute_prepared_tasks  # type: ignore[method-assign]
    service._advance_run_after_candidate_execution = fake_advance_run_after_candidate_execution  # type: ignore[method-assign]

    await service.start_remote_candidate(5, 21)

    assert executed_response_ids == [101]
    assert selected_response.status == "completed"
    assert other_response.status == "pending"


@pytest.mark.asyncio
async def test_advance_run_after_candidate_execution_marks_ready_for_manual_judging() -> None:
    service = ExecutionService(SimpleNamespace())
    run = SimpleNamespace(
        id=5,
        status="running_candidates",
        model_snapshots=[
            SimpleNamespace(id=20, role="candidate", runtime_type="remote"),
            SimpleNamespace(id=30, role="judge", runtime_type="remote"),
        ],
        candidate_responses=[
            SimpleNamespace(model_snapshot_id=20, status="completed"),
        ],
    )
    commit_calls = 0

    class Repository:
        async def commit(self) -> None:
            nonlocal commit_calls
            commit_calls += 1

    service.repository = Repository()  # type: ignore[assignment]

    await service._advance_run_after_candidate_execution(run)

    assert run.status == "ready_for_judging"
    assert commit_calls == 1


def test_format_http_error_describes_timeout() -> None:
    request = httpx.Request("POST", "http://localhost:1234/v1/chat/completions")
    exc = httpx.ReadTimeout("timed out", request=request)

    message = format_http_error(exc, timeout_seconds=60)

    assert message == (
        "Request timed out after 60s while calling "
        "POST http://localhost:1234/v1/chat/completions."
    )


def test_format_http_error_describes_connect_error() -> None:
    request = httpx.Request("POST", "http://localhost:1234/v1/chat/completions")
    exc = httpx.ConnectError("Connection refused", request=request)

    message = format_http_error(exc)

    assert message == (
        "Connection error while calling "
        "POST http://localhost:1234/v1/chat/completions: Connection refused"
    )


def test_resolve_adapter_uses_anthropic_for_anthropic_api_style() -> None:
    service = ExecutionService(SimpleNamespace())

    adapter = service._resolve_adapter(
        SimpleNamespace(api_style="anthropic", provider_type="anthropic")
    )

    assert isinstance(adapter, AnthropicAdapter)
