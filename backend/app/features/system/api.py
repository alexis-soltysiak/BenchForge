from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.system.schemas import HealthResponse
from app.features.system.service import build_health_response

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def healthcheck(
    session: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    payload = await build_health_response(session)
    status_code = (
        status.HTTP_200_OK
        if payload.status == "ok"
        else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())
