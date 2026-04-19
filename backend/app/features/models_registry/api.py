from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.models_registry.schemas import (
    ModelProfileConnectionTestRequest,
    ModelProfileConnectionTestResponse,
    ModelProfileCreate,
    ModelProfileListResponse,
    ModelProfileRead,
    ModelProfileUpdate,
)
from app.features.models_registry.service import (
    ModelProfileNotFoundError,
    ModelProfileService,
    ModelProfileValidationError,
)

router = APIRouter(tags=["model-profiles"])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]
IncludeArchivedQuery = Annotated[bool, Query()]
ModelProfileTestConnectionBody = Annotated[
    ModelProfileConnectionTestRequest,
    Body(default_factory=ModelProfileConnectionTestRequest),
]


def get_model_profile_service(
    session: DbSession,
) -> ModelProfileService:
    return ModelProfileService(session)


ModelProfileServiceDep = Annotated[
    ModelProfileService,
    Depends(get_model_profile_service),
]


@router.get("/model-profiles", response_model=ModelProfileListResponse)
async def list_model_profiles(
    service: ModelProfileServiceDep,
    include_archived: IncludeArchivedQuery = False,
) -> ModelProfileListResponse:
    items, total = await service.list_model_profiles(include_archived)
    return ModelProfileListResponse(items=items, total=total)


@router.get("/model-profiles/machine-labels")
async def list_machine_labels(
    service: ModelProfileServiceDep,
) -> list[str]:
    return await service.get_distinct_machine_labels()


@router.post(
    "/model-profiles",
    response_model=ModelProfileRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_model_profile(
    payload: ModelProfileCreate,
    service: ModelProfileServiceDep,
) -> ModelProfileRead:
    try:
        return await service.create_model_profile(payload)
    except ModelProfileValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/model-profiles/{model_id}", response_model=ModelProfileRead)
async def get_model_profile(
    model_id: int,
    service: ModelProfileServiceDep,
) -> ModelProfileRead:
    try:
        return await service.get_model_profile(model_id)
    except ModelProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.patch("/model-profiles/{model_id}", response_model=ModelProfileRead)
async def update_model_profile(
    model_id: int,
    payload: ModelProfileUpdate,
    service: ModelProfileServiceDep,
) -> ModelProfileRead:
    try:
        return await service.update_model_profile(model_id, payload)
    except ModelProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ModelProfileValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/model-profiles/{model_id}/archive", response_model=ModelProfileRead)
async def archive_model_profile(
    model_id: int,
    service: ModelProfileServiceDep,
) -> ModelProfileRead:
    try:
        return await service.archive_model_profile(model_id)
    except ModelProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.post(
    "/model-profiles/{model_id}/test-connection",
    response_model=ModelProfileConnectionTestResponse,
)
async def test_model_profile_connection(
    model_id: int,
    payload: ModelProfileTestConnectionBody,
    service: ModelProfileServiceDep,
) -> ModelProfileConnectionTestResponse:
    try:
        return await service.test_connection(model_id, payload)
    except ModelProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
