from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.runs.models import (
    ModelGlobalSummary,
    SessionRun,
    SessionRunModelSnapshot,
    SessionRunPromptSnapshot,
)
from app.features.runs.repository import RunRepository
from app.features.runs.schemas import (
    RunGlobalSummaryRead,
    RunListItem,
    RunModelSnapshotRead,
    RunPromptSnapshotRead,
    RunRead,
    RunStatusRead,
)
from app.features.prompts.rendering import render_scenario_prompt
from app.features.sessions.models import (
    BenchmarkSession,
    BenchmarkSessionCandidate,
    BenchmarkSessionJudge,
)


class RunNotFoundError(ValueError):
    pass


class RunLaunchValidationError(ValueError):
    pass


def serialize_prompt_snapshot(
    snapshot: SessionRunPromptSnapshot,
    difficulty: int | None = None,
) -> RunPromptSnapshotRead:
    return RunPromptSnapshotRead(
        id=snapshot.id,
        source_prompt_id=snapshot.source_prompt_id,
        source_prompt_updated_at=snapshot.source_prompt_updated_at,
        name=snapshot.name,
        category_name=snapshot.category_name,
        system_prompt_text=snapshot.system_prompt_text,
        user_prompt_text=snapshot.user_prompt_text,
        evaluation_notes=snapshot.evaluation_notes,
        scenario_type=snapshot.scenario_type,
        objective=snapshot.objective,
        context=snapshot.context,
        input_artifacts_jsonb=snapshot.input_artifacts_jsonb,
        constraints_jsonb=snapshot.constraints_jsonb,
        expected_behavior_jsonb=snapshot.expected_behavior_jsonb,
        gold_facts_jsonb=snapshot.gold_facts_jsonb,
        judge_rubric_jsonb=snapshot.judge_rubric_jsonb,
        estimated_input_tokens=snapshot.estimated_input_tokens,
        expected_output_format=snapshot.expected_output_format,
        cost_tier=snapshot.cost_tier,
        weight=snapshot.weight,
        version=snapshot.version,
        snapshot_order=snapshot.snapshot_order,
        difficulty=difficulty,
    )


def serialize_model_snapshot(snapshot: SessionRunModelSnapshot) -> RunModelSnapshotRead:
    return RunModelSnapshotRead(
        id=snapshot.id,
        source_model_profile_id=snapshot.source_model_profile_id,
        role=snapshot.role,
        display_name=snapshot.display_name,
        provider_type=snapshot.provider_type,
        api_style=snapshot.api_style,
        runtime_type=snapshot.runtime_type,
        machine_label=snapshot.machine_label,
        endpoint_url=snapshot.endpoint_url,
        model_identifier=snapshot.model_identifier,
        timeout_seconds=snapshot.timeout_seconds,
        context_window=snapshot.context_window,
        pricing_input_per_million=snapshot.pricing_input_per_million,
        pricing_output_per_million=snapshot.pricing_output_per_million,
        local_load_instructions=snapshot.local_load_instructions,
    )


def serialize_global_summary(summary: ModelGlobalSummary) -> RunGlobalSummaryRead:
    return RunGlobalSummaryRead(
        id=summary.id,
        model_snapshot_id=summary.model_snapshot_id,
        average_overall_score=summary.average_overall_score,
        average_relevance_score=summary.average_relevance_score,
        average_accuracy_score=summary.average_accuracy_score,
        average_completeness_score=summary.average_completeness_score,
        average_clarity_score=summary.average_clarity_score,
        average_instruction_following_score=summary.average_instruction_following_score,
        avg_duration_ms=summary.avg_duration_ms,
        avg_total_tokens=summary.avg_total_tokens,
        avg_tokens_per_second=summary.avg_tokens_per_second,
        total_estimated_cost=summary.total_estimated_cost,
        global_summary_text=summary.global_summary_text,
        best_patterns_text=summary.best_patterns_text,
        weak_patterns_text=summary.weak_patterns_text,
        final_global_score=summary.final_global_score,
    )


def serialize_run(run: SessionRun, difficulties: dict[int, int | None] | None = None) -> RunRead:
    diff_map = difficulties or {}
    return RunRead(
        id=run.id,
        session_id=run.session_id,
        name=run.name,
        status=run.status,
        launched_at=run.launched_at,
        completed_at=run.completed_at,
        rubric_version=run.rubric_version,
        report_status=run.report_status,
        html_report_path=run.html_report_path,
        pdf_report_path=run.pdf_report_path,
        notes=run.notes,
        prompt_snapshots=[
            serialize_prompt_snapshot(item, difficulty=diff_map.get(item.source_prompt_id))
            for item in sorted(
                run.prompt_snapshots,
                key=lambda value: value.snapshot_order,
            )
        ],
        model_snapshots=[
            serialize_model_snapshot(item)
            for item in sorted(
                run.model_snapshots,
                key=lambda value: (value.role, value.id),
            )
        ],
        global_summaries=[
            serialize_global_summary(item)
            for item in sorted(
                run.global_summaries,
                key=lambda value: value.model_snapshot_id,
            )
        ],
        candidate_response_count=len(run.candidate_responses),
    )


@dataclass
class RunService:
    session: AsyncSession
    repository: RunRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = RunRepository(self.session)

    async def launch_run(self, session_id: int) -> RunRead:
        benchmark_session = await self.repository.get_session_with_relations(session_id)
        if benchmark_session is None:
            raise RunLaunchValidationError(f"Session {session_id} not found.")

        await self._validate_launchable_session(benchmark_session)
        run = await self._build_run_snapshot(benchmark_session)
        self.repository.add_run(run)
        await self.repository.commit()
        stored = await self.repository.get_run(run.id)
        assert stored is not None
        source_ids = [s.source_prompt_id for s in stored.prompt_snapshots]
        difficulties = await self.repository.get_prompt_difficulties(source_ids)
        return serialize_run(stored, difficulties)

    async def list_runs(self) -> tuple[list[RunListItem], int]:
        runs, total = await self.repository.list_runs()
        return [
            RunListItem(
                id=run.id,
                session_id=run.session_id,
                name=run.name,
                status=run.status,
                launched_at=run.launched_at,
                rubric_version=run.rubric_version,
                report_status=run.report_status,
                prompt_count=len(run.prompt_snapshots),
                model_count=len([s for s in run.model_snapshots if s.role != "judge"]),
                judge_count=len([s for s in run.model_snapshots if s.role == "judge"]),
            )
            for run in runs
        ], total

    async def get_run(self, run_id: int) -> RunRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise RunNotFoundError(f"Run {run_id} not found.")
        source_ids = [s.source_prompt_id for s in run.prompt_snapshots]
        difficulties = await self.repository.get_prompt_difficulties(source_ids)
        return serialize_run(run, difficulties)

    async def get_run_status(self, run_id: int) -> RunStatusRead:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise RunNotFoundError(f"Run {run_id} not found.")
        return RunStatusRead(
            id=run.id,
            status=run.status,
            report_status=run.report_status,
            launched_at=run.launched_at,
            completed_at=run.completed_at,
        )

    async def _validate_launchable_session(
        self,
        benchmark_session: BenchmarkSession,
    ) -> None:
        if not benchmark_session.prompts:
            raise RunLaunchValidationError("Session must include at least one prompt.")
        if not benchmark_session.candidates:
            raise RunLaunchValidationError(
                "Session must include at least one candidate."
            )
        if not benchmark_session.judges:
            raise RunLaunchValidationError("Session must include one judge.")

        for item in benchmark_session.prompts:
            prompt = await self.repository.get_prompt(item.prompt_id)
            if prompt is None or prompt.is_archived:
                raise RunLaunchValidationError(
                    f"Prompt {item.prompt_id} is missing or archived."
                )
        model_items = cast(
            list[BenchmarkSessionCandidate | BenchmarkSessionJudge],
            [*benchmark_session.candidates, *benchmark_session.judges],
        )
        for model_item in model_items:
            model_profile = await self.repository.get_model_profile(
                model_item.model_profile_id
            )
            if model_profile is None or model_profile.is_archived:
                raise RunLaunchValidationError(
                    f"Model profile {model_item.model_profile_id} is missing or archived."
                )

    async def _build_run_snapshot(
        self,
        benchmark_session: BenchmarkSession,
    ) -> SessionRun:
        run = SessionRun(
            session_id=benchmark_session.id,
            name=f"{benchmark_session.name} Run",
            status="pending",
            rubric_version=benchmark_session.rubric_version,
            report_status="pending",
            notes=f"Snapshot launched from session {benchmark_session.id}.",
        )
        run.prompt_snapshots = [
            await self._build_prompt_snapshot(item.prompt_id, item.display_order)
            for item in sorted(
                benchmark_session.prompts,
                key=lambda value: value.display_order,
            )
        ]
        run.model_snapshots = [
            await self._build_model_snapshot(item.model_profile_id, "candidate")
            for item in sorted(
                benchmark_session.candidates,
                key=lambda value: value.display_order,
            )
        ] + [
            await self._build_model_snapshot(item.model_profile_id, "judge")
            for item in sorted(
                benchmark_session.judges,
                key=lambda value: value.display_order,
            )
        ]
        return run

    async def _build_prompt_snapshot(
        self,
        prompt_id: int,
        snapshot_order: int,
    ) -> SessionRunPromptSnapshot:
        prompt = await self.repository.get_prompt(prompt_id)
        assert prompt is not None
        return SessionRunPromptSnapshot(
            source_prompt_id=prompt.id,
            source_prompt_updated_at=prompt.updated_at,
            name=prompt.name,
            category_name=prompt.category.name if prompt.category else "Unknown",
            system_prompt_text=prompt.system_prompt_text,
            user_prompt_text=render_scenario_prompt(prompt),
            evaluation_notes=prompt.evaluation_notes,
            scenario_type=prompt.scenario_type,
            objective=prompt.objective,
            context=prompt.context,
            input_artifacts_jsonb=prompt.input_artifacts_jsonb,
            constraints_jsonb=prompt.constraints_jsonb,
            expected_behavior_jsonb=prompt.expected_behavior_jsonb,
            gold_facts_jsonb=prompt.gold_facts_jsonb,
            judge_rubric_jsonb=prompt.judge_rubric_jsonb,
            estimated_input_tokens=prompt.estimated_input_tokens,
            expected_output_format=prompt.expected_output_format,
            cost_tier=prompt.cost_tier,
            weight=prompt.weight,
            version=prompt.version,
            snapshot_order=snapshot_order,
        )

    async def _build_model_snapshot(
        self,
        model_profile_id: int,
        snapshot_role: str,
    ) -> SessionRunModelSnapshot:
        model_profile = await self.repository.get_model_profile(model_profile_id)
        assert model_profile is not None
        return SessionRunModelSnapshot(
            source_model_profile_id=model_profile.id,
            role=snapshot_role,
            display_name=model_profile.display_name,
            provider_type=model_profile.provider_type,
            api_style=model_profile.api_style,
            runtime_type=model_profile.runtime_type,
            machine_label=model_profile.machine_label,
            endpoint_url=model_profile.endpoint_url,
            model_identifier=model_profile.model_identifier,
            timeout_seconds=model_profile.timeout_seconds,
            context_window=model_profile.context_window,
            pricing_input_per_million=(
                str(Decimal(model_profile.pricing_input_per_million))
                if model_profile.pricing_input_per_million is not None
                else None
            ),
            pricing_output_per_million=(
                str(Decimal(model_profile.pricing_output_per_million))
                if model_profile.pricing_output_per_million is not None
                else None
            ),
            local_load_instructions=model_profile.local_load_instructions,
        )
