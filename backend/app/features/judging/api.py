from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import get_db_session
from app.features.judging.schemas import RunJudgingRead
from app.features.judging.service import JudgingError, JudgingService

router = APIRouter(tags=["judging"])
db_session_dependency = Depends(get_db_session)


def get_judging_service(
    session: AsyncSession = db_session_dependency,
) -> JudgingService:
    return JudgingService(session)


judging_service_dependency = Depends(get_judging_service)


async def run_judging_background(
    run_id: int,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        service = JudgingService(session)
        await service.continue_judging(run_id)


@router.get("/runs/{run_id}/judging", response_model=RunJudgingRead)
async def get_run_judging(
    run_id: int,
    service: JudgingService = judging_service_dependency,
) -> RunJudgingRead:
    try:
        return await service.get_run_judging(run_id)
    except JudgingError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/runs/{run_id}/judging/start", response_model=RunJudgingRead)
async def start_run_judging(
    run_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    service: JudgingService = judging_service_dependency,
) -> RunJudgingRead:
    try:
        response = await service.start_judging(run_id)
        session_factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
        background_tasks.add_task(run_judging_background, run_id, session_factory)
        return response
    except JudgingError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/runs/{run_id}/judging/retry", response_model=RunJudgingRead)
async def retry_run_judging(
    run_id: int,
    service: JudgingService = judging_service_dependency,
) -> RunJudgingRead:
    try:
        return await service.retry_judging(run_id)
    except JudgingError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/runs/{run_id}/judging/clear", response_model=RunJudgingRead)
async def clear_run_judging(
    run_id: int,
    service: JudgingService = judging_service_dependency,
) -> RunJudgingRead:
    try:
        return await service.clear_judging(run_id)
    except JudgingError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/runs/{run_id}/judging/restart", response_model=RunJudgingRead)
async def restart_run_judging(
    run_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    service: JudgingService = judging_service_dependency,
) -> RunJudgingRead:
    try:
        response = await service.restart_judging(run_id)
        session_factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
        background_tasks.add_task(run_judging_background, run_id, session_factory)
        return response
    except JudgingError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/runs/{run_id}/judging/batches/{batch_id}/retry", response_model=RunJudgingRead)
async def retry_judge_batch(
    run_id: int,
    batch_id: int,
    service: JudgingService = judging_service_dependency,
) -> RunJudgingRead:
    try:
        return await service.retry_batch(run_id, batch_id)
    except JudgingError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc
