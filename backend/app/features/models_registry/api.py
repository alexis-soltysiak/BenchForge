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
)

router = APIRouter(tags=["model-profiles"])


def get_model_profile_service(
    session: AsyncSession = Depends(get_db_session),
) -> ModelProfileService:
    return ModelProfileService(session)


@router.get("/model-profiles", response_model=ModelProfileListResponse)
async def list_model_profiles(
    include_archived: bool = Query(default=False),
    service: ModelProfileService = Depends(get_model_profile_service),
) -> ModelProfileListResponse:
    items, total = await service.list_model_profiles(include_archived)
    return ModelProfileListResponse(items=items, total=total)


@router.get("/model-profiles/machine-labels")
async def list_machine_labels(
    service: ModelProfileService = Depends(get_model_profile_service),
) -> list[str]:
    return await service.get_distinct_machine_labels()


@router.post(
    "/model-profiles",
    response_model=ModelProfileRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_model_profile(
    payload: ModelProfileCreate,
    service: ModelProfileService = Depends(get_model_profile_service),
) -> ModelProfileRead:
    return await service.create_model_profile(payload)


@router.get("/model-profiles/{model_id}", response_model=ModelProfileRead)
async def get_model_profile(
    model_id: int,
    service: ModelProfileService = Depends(get_model_profile_service),
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
    service: ModelProfileService = Depends(get_model_profile_service),
) -> ModelProfileRead:
    try:
        return await service.update_model_profile(model_id, payload)
    except ModelProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.post("/model-profiles/{model_id}/archive", response_model=ModelProfileRead)
async def archive_model_profile(
    model_id: int,
    service: ModelProfileService = Depends(get_model_profile_service),
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
    payload: ModelProfileConnectionTestRequest = Body(
        default_factory=ModelProfileConnectionTestRequest
    ),
    service: ModelProfileService = Depends(get_model_profile_service),
) -> ModelProfileConnectionTestResponse:
    try:
        return await service.test_connection(model_id, payload)
    except ModelProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
