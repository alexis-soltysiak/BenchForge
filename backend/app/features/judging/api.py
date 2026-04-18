from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

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
