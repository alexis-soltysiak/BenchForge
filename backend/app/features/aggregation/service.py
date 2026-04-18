from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.aggregation.repository import AggregationRepository
from app.features.reports.service import ReportsService
from app.features.runs.models import CandidateResponse, ModelGlobalSummary, SessionRun

QUALITY_WEIGHT = Decimal("0.70")
COST_WEIGHT = Decimal("0.15")
PERFORMANCE_WEIGHT = Decimal("0.15")


class AggregationError(ValueError):
    pass


@dataclass
class AggregationService:
    session: AsyncSession
    repository: AggregationRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = AggregationRepository(self.session)

    async def aggregate_run(self, run_id: int) -> None:
        run = await self.repository.get_run(run_id)
        if run is None:
            raise AggregationError(f"Run {run_id} not found.")

        candidate_snapshots = [
            snapshot
            for snapshot in run.model_snapshots
            if snapshot.role == "candidate"
        ]
        if not candidate_snapshots:
            raise AggregationError("Run does not contain candidate snapshots.")

        judge_candidates = [
            candidate
            for batch in run.judge_batches
            if batch.evaluation is not None
            for candidate in batch.evaluation.candidates
        ]
        if not judge_candidates:
            raise AggregationError(
                "Run has no completed judge evaluations to aggregate."
            )

        await self.repository.clear_global_summaries(run.id)

        candidate_payloads = [
            self._build_candidate_payload(run, snapshot.id)
            for snapshot in candidate_snapshots
        ]
        cost_scores = self._normalize_inverse(
            {
                payload["model_snapshot_id"]: payload["total_estimated_cost"]
                for payload in candidate_payloads
            }
        )
        performance_scores = self._normalize_performance(candidate_payloads)

        for payload in candidate_payloads:
            quality_score = payload["average_overall_score"]
            cost_score = cost_scores[payload["model_snapshot_id"]]
            performance_score = performance_scores[payload["model_snapshot_id"]]
            final_global_score = (
                (quality_score * QUALITY_WEIGHT)
                + (cost_score * COST_WEIGHT)
                + (performance_score * PERFORMANCE_WEIGHT)
            ).quantize(Decimal("0.01"))

            self.repository.add_global_summary(
                ModelGlobalSummary(
                    run_id=run.id,
                    model_snapshot_id=payload["model_snapshot_id"],
                    average_overall_score=str(quality_score),
                    average_relevance_score=str(payload["average_relevance_score"]),
                    average_accuracy_score=str(payload["average_accuracy_score"]),
                    average_completeness_score=str(
                        payload["average_completeness_score"]
                    ),
                    average_clarity_score=str(payload["average_clarity_score"]),
                    average_instruction_following_score=str(
                        payload["average_instruction_following_score"]
                    ),
                    avg_duration_ms=payload["avg_duration_ms"],
                    avg_total_tokens=payload["avg_total_tokens"],
                    avg_tokens_per_second=(
                        str(payload["avg_tokens_per_second"])
                        if payload["avg_tokens_per_second"] is not None
                        else None
                    ),
                    total_estimated_cost=(
                        str(payload["total_estimated_cost"])
                        if payload["total_estimated_cost"] is not None
                        else None
                    ),
                    global_summary_text=self._build_global_summary_text(
                        prompt_count=payload["prompt_count"],
                        quality_score=quality_score,
                        avg_duration_ms=payload["avg_duration_ms"],
                    ),
                    best_patterns_text=payload["best_patterns_text"],
                    weak_patterns_text=payload["weak_patterns_text"],
                    final_global_score=str(final_global_score),
                )
            )

        run.status = "reporting"
        run.report_status = "pending"
        await self.repository.commit()
        await self._run_report_generation(run.id)

    def _build_candidate_payload(
        self,
        run: SessionRun,
        model_snapshot_id: int,
    ) -> dict[str, Decimal | int | str | None]:
        judged_candidates = [
            candidate
            for batch in run.judge_batches
            if batch.evaluation is not None
            for candidate in batch.evaluation.candidates
            if self._candidate_response_for_id(
                run.candidate_responses,
                candidate.candidate_response_id,
            ).model_snapshot_id
            == model_snapshot_id
        ]
        if not judged_candidates:
            raise AggregationError(
                f"Candidate snapshot {model_snapshot_id} has no judged evaluations."
            )

        responses = [
            response
            for response in run.candidate_responses
            if response.model_snapshot_id == model_snapshot_id
        ]
        duration_values = [
            Decimal(metric.duration_ms)
            for response in responses
            if response.metric is not None and response.metric.duration_ms is not None
            for metric in [response.metric]
        ]
        total_tokens_values = [
            Decimal(metric.total_tokens)
            for response in responses
            if response.metric is not None and response.metric.total_tokens is not None
            for metric in [response.metric]
        ]
        tokens_per_second_values = [
            Decimal(metric.tokens_per_second)
            for response in responses
            if response.metric is not None
            and response.metric.tokens_per_second is not None
            for metric in [response.metric]
        ]
        estimated_cost_values = [
            Decimal(metric.estimated_cost)
            for response in responses
            if response.metric is not None
            and response.metric.estimated_cost is not None
            for metric in [response.metric]
        ]

        strengths = Counter(
            text.strip()
            for candidate in judged_candidates
            for text in self._split_feedback(candidate.strengths_text)
        )
        weaknesses = Counter(
            text.strip()
            for candidate in judged_candidates
            for text in self._split_feedback(candidate.weaknesses_text)
        )

        return {
            "model_snapshot_id": model_snapshot_id,
            "prompt_count": len(judged_candidates),
            "average_overall_score": self._average_decimal(
                [candidate.overall_score for candidate in judged_candidates]
            ),
            "average_relevance_score": self._average_decimal(
                [candidate.relevance_score for candidate in judged_candidates]
            ),
            "average_accuracy_score": self._average_decimal(
                [candidate.accuracy_score for candidate in judged_candidates]
            ),
            "average_completeness_score": self._average_decimal(
                [candidate.completeness_score for candidate in judged_candidates]
            ),
            "average_clarity_score": self._average_decimal(
                [candidate.clarity_score for candidate in judged_candidates]
            ),
            "average_instruction_following_score": self._average_decimal(
                [
                    candidate.instruction_following_score
                    for candidate in judged_candidates
                ]
            ),
            "avg_duration_ms": self._average_int(duration_values),
            "avg_total_tokens": self._average_int(total_tokens_values),
            "avg_tokens_per_second": self._average_decimal_or_none(
                tokens_per_second_values
            ),
            "total_estimated_cost": (
                sum(estimated_cost_values, Decimal("0.00")).quantize(Decimal("0.01"))
                if estimated_cost_values
                else None
            ),
            "best_patterns_text": self._top_patterns(strengths),
            "weak_patterns_text": self._top_patterns(weaknesses),
        }

    def _candidate_response_for_id(
        self,
        responses: list[CandidateResponse],
        candidate_response_id: int,
    ) -> CandidateResponse:
        return next(
            response
            for response in responses
            if response.id == candidate_response_id
        )

    def _average_decimal(self, values: list[Decimal]) -> Decimal:
        if not values:
            return Decimal("0.00")
        return (sum(values, Decimal("0.00")) / Decimal(len(values))).quantize(
            Decimal("0.01")
        )

    def _average_decimal_or_none(self, values: list[Decimal]) -> Decimal | None:
        if not values:
            return None
        return self._average_decimal(values)

    def _average_int(self, values: list[Decimal]) -> int | None:
        if not values:
            return None
        return int(sum(values, Decimal("0.00")) / Decimal(len(values)))

    def _split_feedback(self, text: str | None) -> list[str]:
        if not text:
            return []
        return [item for item in [part.strip() for part in text.split(";")] if item]

    def _top_patterns(self, counter: Counter[str]) -> str | None:
        if not counter:
            return None
        return "; ".join(item for item, _ in counter.most_common(3))

    def _build_global_summary_text(
        self,
        *,
        prompt_count: int,
        quality_score: Decimal,
        avg_duration_ms: int | None,
    ) -> str:
        if avg_duration_ms is None:
            return (
                f"Average overall score {quality_score} across {prompt_count} prompts."
            )
        return (
            f"Average overall score {quality_score} across {prompt_count} prompts "
            f"with mean latency {avg_duration_ms} ms."
        )

    def _normalize_inverse(
        self,
        values: dict[int, Decimal | None],
    ) -> dict[int, Decimal]:
        present = {key: value for key, value in values.items() if value is not None}
        if not present:
            return {key: Decimal("100.00") for key in values}
        low = min(present.values())
        high = max(present.values())
        if low == high:
            return {key: Decimal("100.00") for key in values}

        normalized: dict[int, Decimal] = {}
        spread = high - low
        for key, value in values.items():
            if value is None:
                normalized[key] = Decimal("50.00")
                continue
            normalized[key] = (
                Decimal("100.00") * (high - value) / spread
            ).quantize(Decimal("0.01"))
        return normalized

    def _normalize_direct(
        self,
        values: dict[int, Decimal | None],
    ) -> dict[int, Decimal]:
        present = {key: value for key, value in values.items() if value is not None}
        if not present:
            return {key: Decimal("100.00") for key in values}
        low = min(present.values())
        high = max(present.values())
        if low == high:
            return {key: Decimal("100.00") for key in values}

        normalized: dict[int, Decimal] = {}
        spread = high - low
        for key, value in values.items():
            if value is None:
                normalized[key] = Decimal("50.00")
                continue
            normalized[key] = (
                Decimal("100.00") * (value - low) / spread
            ).quantize(Decimal("0.01"))
        return normalized

    def _normalize_performance(
        self,
        payloads: list[dict[str, Decimal | int | str | None]],
    ) -> dict[int, Decimal]:
        latency_scores = self._normalize_inverse(
            {
                int(payload["model_snapshot_id"]): (
                    Decimal(payload["avg_duration_ms"])
                    if payload["avg_duration_ms"] is not None
                    else None
                )
                for payload in payloads
            }
        )
        throughput_scores = self._normalize_direct(
            {
                int(payload["model_snapshot_id"]): payload["avg_tokens_per_second"]  # type: ignore[index]
                for payload in payloads
            }
        )
        return {
            int(payload["model_snapshot_id"]): (
                (
                    latency_scores[int(payload["model_snapshot_id"])]
                    + throughput_scores[int(payload["model_snapshot_id"])]
                )
                / Decimal("2")
            ).quantize(Decimal("0.01"))
            for payload in payloads
        }

    async def _run_report_generation(self, run_id: int) -> None:
        reports_service = ReportsService(self.session)
        await reports_service.generate_report(run_id)
