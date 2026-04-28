from __future__ import annotations

from dataclasses import dataclass, field
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.models_registry.models import ModelProfile
from app.features.prompts.models import Prompt
from app.features.sessions.models import (
    BenchmarkSession,
    BenchmarkSessionCandidate,
    BenchmarkSessionJudge,
    BenchmarkSessionPrompt,
)
from app.features.sessions.repository import SessionRepository
from app.features.sessions.schemas import (
    SessionCandidateCreate,
    SessionCreate,
    SessionJudgeCreate,
    SessionModelItem,
    SessionPromptCreate,
    SessionPromptItem,
    SessionRead,
    SessionUpdate,
)


class BenchmarkSessionNotFoundError(ValueError):
    pass


class SessionPromptNotFoundError(ValueError):
    pass


class SessionCandidateNotFoundError(ValueError):
    pass


class SessionJudgeNotFoundError(ValueError):
    pass


class SessionValidationError(ValueError):
    pass


def serialize_prompt_item(item: BenchmarkSessionPrompt, prompt: Prompt | None) -> SessionPromptItem:
    return SessionPromptItem(
        id=item.id,
        prompt_id=item.prompt_id,
        prompt_name=prompt.name if prompt is not None else f"Prompt {item.prompt_id}",
        category_name=prompt.category.name if prompt is not None and prompt.category else None,
        cost_tier=prompt.cost_tier if prompt is not None else None,
        estimated_input_tokens=prompt.estimated_input_tokens if prompt is not None else None,
        scenario_type=prompt.scenario_type if prompt is not None else None,
        display_order=item.display_order,
    )


def serialize_model_item(
    item: BenchmarkSessionCandidate | BenchmarkSessionJudge,
    model_profile: ModelProfile | None,
) -> SessionModelItem:
    return SessionModelItem(
        id=item.id,
        model_profile_id=item.model_profile_id,
        display_name=(
            model_profile.display_name
            if model_profile is not None
            else f"Model {item.model_profile_id}"
        ),
        role=model_profile.role if model_profile is not None else "unknown",
        runtime_type=model_profile.runtime_type if model_profile is not None else "unknown",
        provider_type=model_profile.provider_type if model_profile is not None else "unknown",
        display_order=item.display_order,
    )


@dataclass
class SessionService:
    session: AsyncSession
    repository: SessionRepository = field(init=False)

    def __post_init__(self) -> None:
        self.repository = SessionRepository(self.session)

    async def list_sessions(self, include_archived: bool) -> tuple[list[SessionRead], int]:
        sessions, total = await self.repository.list_sessions(include_archived)
        return [await self._serialize_session(session) for session in sessions], total

    async def get_session(self, session_id: int) -> SessionRead:
        benchmark_session = await self.repository.get_session(session_id)
        if benchmark_session is None:
            raise BenchmarkSessionNotFoundError(f"Session {session_id} not found.")
        return await self._serialize_session(benchmark_session)

    async def create_session(self, payload: SessionCreate) -> SessionRead:
        benchmark_session = BenchmarkSession(
            name=payload.name.strip(),
            description=payload.description.strip() if payload.description else None,
            status=payload.status,
            max_candidates=payload.max_candidates,
            rubric_version=payload.rubric_version.strip(),
        )
        self.repository.add_session(benchmark_session)
        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def update_session(self, session_id: int, payload: SessionUpdate) -> SessionRead:
        benchmark_session = await self.repository.get_session(session_id)
        if benchmark_session is None:
            raise BenchmarkSessionNotFoundError(f"Session {session_id} not found.")

        updates = payload.model_dump(exclude_unset=True)
        if "name" in updates and updates["name"] is not None:
            benchmark_session.name = updates["name"].strip()
        if "description" in updates:
            benchmark_session.description = (
                updates["description"].strip() if updates["description"] else None
            )
        if "status" in updates and updates["status"] is not None:
            benchmark_session.status = updates["status"]
        if "max_candidates" in updates and updates["max_candidates"] is not None:
            benchmark_session.max_candidates = updates["max_candidates"]
        if "rubric_version" in updates and updates["rubric_version"] is not None:
            benchmark_session.rubric_version = updates["rubric_version"].strip()

        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def archive_session(self, session_id: int) -> SessionRead:
        benchmark_session = await self.repository.get_session(session_id)
        if benchmark_session is None:
            raise BenchmarkSessionNotFoundError(f"Session {session_id} not found.")

        benchmark_session.status = "archived"
        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def add_prompt(self, session_id: int, payload: SessionPromptCreate) -> SessionRead:
        benchmark_session = await self._require_session(session_id)
        prompt = await self.repository.get_prompt(payload.prompt_id)
        if prompt is None or prompt.is_archived:
            raise SessionValidationError(
                f"Prompt {payload.prompt_id} is missing or archived."
            )
        if any(item.prompt_id == payload.prompt_id for item in benchmark_session.prompts):
            raise SessionValidationError("Prompt already attached to session.")

        display_order = payload.display_order or (len(benchmark_session.prompts) + 1)
        self.repository.add_session_prompt(
            BenchmarkSessionPrompt(
                session_id=benchmark_session.id,
                prompt_id=payload.prompt_id,
                display_order=display_order,
            )
        )
        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def remove_prompt(self, session_id: int, session_prompt_id: int) -> SessionRead:
        benchmark_session = await self._require_session(session_id)
        target = next(
            (item for item in benchmark_session.prompts if item.id == session_prompt_id),
            None,
        )
        if target is None:
            raise SessionPromptNotFoundError(
                f"Session prompt {session_prompt_id} not found."
            )
        await self.repository.delete(target)
        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def add_candidate(
        self,
        session_id: int,
        payload: SessionCandidateCreate,
    ) -> SessionRead:
        benchmark_session = await self._require_session(session_id)
        model_profile = await self.repository.get_model_profile(payload.model_profile_id)
        self._validate_model_for_candidate(model_profile, payload.model_profile_id)
        if any(
            item.model_profile_id == payload.model_profile_id
            for item in benchmark_session.candidates
        ):
            raise SessionValidationError("Candidate model already attached to session.")

        display_order = payload.display_order or (len(benchmark_session.candidates) + 1)
        self.repository.add_session_candidate(
            BenchmarkSessionCandidate(
                session_id=benchmark_session.id,
                model_profile_id=payload.model_profile_id,
                display_order=display_order,
            )
        )
        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def remove_candidate(
        self,
        session_id: int,
        session_candidate_id: int,
    ) -> SessionRead:
        benchmark_session = await self._require_session(session_id)
        target = next(
            (item for item in benchmark_session.candidates if item.id == session_candidate_id),
            None,
        )
        if target is None:
            raise SessionCandidateNotFoundError(
                f"Session candidate {session_candidate_id} not found."
            )
        await self.repository.delete(target)
        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def add_judge(self, session_id: int, payload: SessionJudgeCreate) -> SessionRead:
        benchmark_session = await self._require_session(session_id)
        model_profile = await self.repository.get_model_profile(payload.model_profile_id)
        self._validate_model_for_judge(model_profile, payload.model_profile_id)
        if any(
            item.model_profile_id == payload.model_profile_id for item in benchmark_session.judges
        ):
            raise SessionValidationError("Judge model already attached to session.")

        display_order = payload.display_order or (len(benchmark_session.judges) + 1)
        self.repository.add_session_judge(
            BenchmarkSessionJudge(
                session_id=benchmark_session.id,
                model_profile_id=payload.model_profile_id,
                display_order=display_order,
            )
        )
        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def remove_judge(self, session_id: int, session_judge_id: int) -> SessionRead:
        benchmark_session = await self._require_session(session_id)
        target = next(
            (item for item in benchmark_session.judges if item.id == session_judge_id),
            None,
        )
        if target is None:
            raise SessionJudgeNotFoundError(f"Session judge {session_judge_id} not found.")
        await self.repository.delete(target)
        await self.repository.commit()
        return await self.get_session(benchmark_session.id)

    async def duplicate_session(self, session_id: int) -> SessionRead:
        benchmark_session = await self._require_session(session_id)
        duplicated = BenchmarkSession(
            name=f"{benchmark_session.name} Copy",
            description=benchmark_session.description,
            status="draft",
            max_candidates=benchmark_session.max_candidates,
            rubric_version=benchmark_session.rubric_version,
        )
        duplicated.prompts = [
            BenchmarkSessionPrompt(
                prompt_id=item.prompt_id,
                display_order=item.display_order,
            )
            for item in benchmark_session.prompts
        ]
        duplicated.candidates = [
            BenchmarkSessionCandidate(
                model_profile_id=item.model_profile_id,
                display_order=item.display_order,
            )
            for item in benchmark_session.candidates
        ]
        duplicated.judges = [
            BenchmarkSessionJudge(
                model_profile_id=item.model_profile_id,
                display_order=item.display_order,
            )
            for item in benchmark_session.judges
        ]
        self.repository.add_session(duplicated)
        await self.repository.commit()
        return await self.get_session(duplicated.id)

    async def _require_session(self, session_id: int) -> BenchmarkSession:
        benchmark_session = await self.repository.get_session(session_id)
        if benchmark_session is None:
            raise BenchmarkSessionNotFoundError(f"Session {session_id} not found.")
        return benchmark_session

    def _validate_model_for_candidate(
        self,
        model_profile: ModelProfile | None,
        model_profile_id: int,
    ) -> None:
        if model_profile is None or model_profile.is_archived:
            raise SessionValidationError(
                f"Model profile {model_profile_id} is missing or archived."
            )
        if model_profile.role not in {"candidate", "both"}:
            raise SessionValidationError(
                f"Model profile {model_profile_id} cannot be used as a candidate."
            )

    def _validate_model_for_judge(
        self,
        model_profile: ModelProfile | None,
        model_profile_id: int,
    ) -> None:
        if model_profile is None or model_profile.is_archived:
            raise SessionValidationError(
                f"Model profile {model_profile_id} is missing or archived."
            )
        if model_profile.role not in {"judge", "both"}:
            raise SessionValidationError(
                f"Model profile {model_profile_id} cannot be used as a judge."
            )

    async def _serialize_session(self, benchmark_session: BenchmarkSession) -> SessionRead:
        prompt_map = {
            item.prompt_id: await self.repository.get_prompt(item.prompt_id)
            for item in benchmark_session.prompts
        }
        model_items = cast(
            list[BenchmarkSessionCandidate | BenchmarkSessionJudge],
            [*benchmark_session.candidates, *benchmark_session.judges],
        )
        model_map = {
            item.model_profile_id: await self.repository.get_model_profile(
                item.model_profile_id
            )
            for item in model_items
        }
        return SessionRead(
            id=benchmark_session.id,
            name=benchmark_session.name,
            description=benchmark_session.description,
            status=benchmark_session.status,
            max_candidates=benchmark_session.max_candidates,
            rubric_version=benchmark_session.rubric_version,
            prompts=[
                serialize_prompt_item(item, prompt_map.get(item.prompt_id))
                for item in sorted(benchmark_session.prompts, key=lambda value: value.display_order)
            ],
            candidates=[
                serialize_model_item(item, model_map.get(item.model_profile_id))
                for item in sorted(
                    benchmark_session.candidates,
                    key=lambda value: value.display_order,
                )
            ],
            judges=[
                serialize_model_item(item, model_map.get(item.model_profile_id))
                for item in sorted(
                    benchmark_session.judges,
                    key=lambda value: value.display_order,
                )
            ],
            created_at=benchmark_session.created_at,
            updated_at=benchmark_session.updated_at,
        )
