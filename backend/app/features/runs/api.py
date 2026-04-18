from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.runs.schemas import RunListResponse, RunRead, RunStatusRead
from app.features.runs.service import RunLaunchValidationError, RunNotFoundError, RunService

router = APIRouter(tags=["runs"])


def get_run_service(session: AsyncSession = Depends(get_db_session)) -> RunService:
    return RunService(session)


@router.post("/sessions/{session_id}/launch", response_model=RunRead, status_code=status.HTTP_201_CREATED)
async def launch_session_run(
    session_id: int,
    service: RunService = Depends(get_run_service),
) -> RunRead:
    try:
        return await service.launch_run(session_id)
    except RunLaunchValidationError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.get("/runs", response_model=RunListResponse)
async def list_runs(service: RunService = Depends(get_run_service)) -> RunListResponse:
    items, total = await service.list_runs()
    return RunListResponse(items=items, total=total)


@router.get("/runs/{run_id}", response_model=RunRead)
async def get_run(run_id: int, service: RunService = Depends(get_run_service)) -> RunRead:
    try:
        return await service.get_run(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/runs/{run_id}/status", response_model=RunStatusRead)
async def get_run_status(
    run_id: int,
    service: RunService = Depends(get_run_service),
) -> RunStatusRead:
    try:
        return await service.get_run_status(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

