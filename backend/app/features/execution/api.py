from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.execution.schemas import (
    CandidateResponseListResponse,
    CandidateResponseRead,
    LocalExecutionNextResponse,
)
from app.features.execution.service import (
    CandidateResponseNotFoundError,
    ExecutionError,
    ExecutionService,
    LocalExecutionNotReadyError,
)

router = APIRouter(tags=["execution"])


def get_execution_service(
    session: AsyncSession = Depends(get_db_session),
) -> ExecutionService:
    return ExecutionService(session)


@router.post("/runs/{run_id}/resume", response_model=CandidateResponseListResponse)
async def resume_run(
    run_id: int,
    service: ExecutionService = Depends(get_execution_service),
) -> CandidateResponseListResponse:
    try:
        return await service.resume_run(run_id)
    except ExecutionError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.get("/runs/{run_id}/responses", response_model=CandidateResponseListResponse)
async def list_candidate_responses(
    run_id: int,
    service: ExecutionService = Depends(get_execution_service),
) -> CandidateResponseListResponse:
    return await service.list_candidate_responses(run_id)


@router.get("/runs/{run_id}/responses/{response_id}", response_model=CandidateResponseRead)
async def get_candidate_response(
    run_id: int,
    response_id: int,
    service: ExecutionService = Depends(get_execution_service),
) -> CandidateResponseRead:
    try:
        response = await service.get_candidate_response(response_id)
    except CandidateResponseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if response.run_id != run_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate response not found for run.")
    return response


@router.get("/runs/{run_id}/local-next", response_model=LocalExecutionNextResponse)
async def get_local_next(
    run_id: int,
    service: ExecutionService = Depends(get_execution_service),
) -> LocalExecutionNextResponse:
    try:
        return await service.get_local_next(run_id)
    except ExecutionError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LocalExecutionNotReadyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/runs/{run_id}/local-confirm-ready", response_model=LocalExecutionNextResponse)
async def confirm_local_ready(
    run_id: int,
    service: ExecutionService = Depends(get_execution_service),
) -> LocalExecutionNextResponse:
    try:
        return await service.confirm_local_ready(run_id)
    except ExecutionError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LocalExecutionNotReadyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/runs/{run_id}/local-start-current", response_model=CandidateResponseListResponse)
async def start_local_current(
    run_id: int,
    service: ExecutionService = Depends(get_execution_service),
) -> CandidateResponseListResponse:
    try:
        return await service.start_local_current(run_id)
    except ExecutionError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LocalExecutionNotReadyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
