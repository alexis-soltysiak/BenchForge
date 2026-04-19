from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.api_key_presets.schemas import (
    ApiKeyPresetCreate,
    ApiKeyPresetListResponse,
    ApiKeyPresetRead,
    ApiKeyPresetUpdate,
)
from app.features.api_key_presets.service import (
    ApiKeyPresetNotFoundError,
    ApiKeyPresetService,
)

router = APIRouter(tags=["api-key-presets"])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]


def get_api_key_preset_service(
    session: DbSession,
) -> ApiKeyPresetService:
    return ApiKeyPresetService(session)


ApiKeyPresetServiceDep = Annotated[
    ApiKeyPresetService,
    Depends(get_api_key_preset_service),
]


@router.get("/api-key-presets", response_model=ApiKeyPresetListResponse)
async def list_api_key_presets(
    service: ApiKeyPresetServiceDep,
) -> ApiKeyPresetListResponse:
    return await service.list_api_key_presets()


@router.post(
    "/api-key-presets",
    response_model=ApiKeyPresetRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key_preset(
    payload: ApiKeyPresetCreate,
    service: ApiKeyPresetServiceDep,
) -> ApiKeyPresetRead:
    return await service.create_api_key_preset(payload)


@router.patch("/api-key-presets/{preset_id}", response_model=ApiKeyPresetRead)
async def update_api_key_preset(
    preset_id: int,
    payload: ApiKeyPresetUpdate,
    service: ApiKeyPresetServiceDep,
) -> ApiKeyPresetRead:
    try:
        return await service.update_api_key_preset(preset_id, payload)
    except ApiKeyPresetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.delete("/api-key-presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key_preset(
    preset_id: int,
    service: ApiKeyPresetServiceDep,
) -> None:
    try:
        await service.delete_api_key_preset(preset_id)
    except ApiKeyPresetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
