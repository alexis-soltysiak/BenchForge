from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.sessions.schemas import (
    SessionCandidateCreate,
    SessionCreate,
    SessionJudgeCreate,
    SessionListResponse,
    SessionPromptCreate,
    SessionPromptSamplingModeUpdate,
    SessionRead,
    SessionUpdate,
)
from app.features.sessions.service import (
    BenchmarkSessionNotFoundError,
    SessionCandidateNotFoundError,
    SessionJudgeNotFoundError,
    SessionPromptNotFoundError,
    SessionService,
    SessionValidationError,
)


router = APIRouter(tags=["sessions"])


def get_session_service(
    session: AsyncSession = Depends(get_db_session),
) -> SessionService:
    return SessionService(session)


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    include_archived: bool = Query(default=False),
    service: SessionService = Depends(get_session_service),
) -> SessionListResponse:
    items, total = await service.list_sessions(include_archived)
    return SessionListResponse(items=items, total=total)


@router.post("/sessions", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    return await service.create_session(payload)


@router.get("/sessions/{session_id}", response_model=SessionRead)
async def get_session(
    session_id: int,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.get_session(session_id)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/sessions/{session_id}", response_model=SessionRead)
async def update_session(
    session_id: int,
    payload: SessionUpdate,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.update_session(session_id, payload)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SessionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/archive", response_model=SessionRead)
async def archive_session(
    session_id: int,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.archive_session(session_id)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/prompts", response_model=SessionRead)
async def add_session_prompt(
    session_id: int,
    payload: SessionPromptCreate,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.add_prompt(session_id, payload)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SessionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/sessions/{session_id}/prompts/{session_prompt_id}", response_model=SessionRead)
async def update_session_prompt_sampling_mode(
    session_id: int,
    session_prompt_id: int,
    payload: SessionPromptSamplingModeUpdate,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.update_prompt_sampling_mode(session_id, session_prompt_id, payload)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SessionPromptNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/sessions/{session_id}/prompts/{session_prompt_id}", response_model=SessionRead)
async def remove_session_prompt(
    session_id: int,
    session_prompt_id: int,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.remove_prompt(session_id, session_prompt_id)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SessionPromptNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/candidates", response_model=SessionRead)
async def add_session_candidate(
    session_id: int,
    payload: SessionCandidateCreate,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.add_candidate(session_id, payload)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SessionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete(
    "/sessions/{session_id}/candidates/{session_candidate_id}",
    response_model=SessionRead,
)
async def remove_session_candidate(
    session_id: int,
    session_candidate_id: int,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.remove_candidate(session_id, session_candidate_id)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SessionCandidateNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/judges", response_model=SessionRead)
async def add_session_judge(
    session_id: int,
    payload: SessionJudgeCreate,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.add_judge(session_id, payload)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SessionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/sessions/{session_id}/judges/{session_judge_id}", response_model=SessionRead)
async def remove_session_judge(
    session_id: int,
    session_judge_id: int,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.remove_judge(session_id, session_judge_id)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SessionJudgeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/duplicate", response_model=SessionRead)
async def duplicate_session(
    session_id: int,
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    try:
        return await service.duplicate_session(session_id)
    except BenchmarkSessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

