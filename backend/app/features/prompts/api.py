from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.prompts.schemas import (
    PromptCategoryRead,
    PromptCreate,
    PromptListResponse,
    PromptRead,
    PromptUpdate,
)
from app.features.prompts.service import (
    PromptCategoryNotFoundError,
    PromptNotFoundError,
    PromptService,
)

router = APIRouter(tags=["prompts"])


def get_prompt_service(
    session: AsyncSession = Depends(get_db_session),
) -> PromptService:
    return PromptService(session)


@router.get("/prompt-categories", response_model=list[PromptCategoryRead])
async def list_prompt_categories(
    service: PromptService = Depends(get_prompt_service),
) -> list[PromptCategoryRead]:
    categories = await service.list_categories()
    return [PromptCategoryRead.model_validate(category) for category in categories]


@router.get("/prompts", response_model=PromptListResponse)
async def list_prompts(
    include_archived: bool = Query(default=False),
    service: PromptService = Depends(get_prompt_service),
) -> PromptListResponse:
    items, total = await service.list_prompts(include_archived)
    return PromptListResponse(items=items, total=total)


@router.post("/prompts", response_model=PromptRead, status_code=status.HTTP_201_CREATED)
async def create_prompt(
    payload: PromptCreate,
    service: PromptService = Depends(get_prompt_service),
) -> PromptRead:
    try:
        return await service.create_prompt(payload)
    except PromptCategoryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.get("/prompts/{prompt_id}", response_model=PromptRead)
async def get_prompt(
    prompt_id: int,
    service: PromptService = Depends(get_prompt_service),
) -> PromptRead:
    try:
        return await service.get_prompt(prompt_id)
    except PromptNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.patch("/prompts/{prompt_id}", response_model=PromptRead)
async def update_prompt(
    prompt_id: int,
    payload: PromptUpdate,
    service: PromptService = Depends(get_prompt_service),
) -> PromptRead:
    try:
        return await service.update_prompt(prompt_id, payload)
    except PromptNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except PromptCategoryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.post("/prompts/{prompt_id}/archive", response_model=PromptRead)
async def archive_prompt(
    prompt_id: int,
    service: PromptService = Depends(get_prompt_service),
) -> PromptRead:
    try:
        return await service.archive_prompt(prompt_id)
    except PromptNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.post("/prompts/reset-builtin", response_model=dict)
async def reset_builtin_prompts(
    service: PromptService = Depends(get_prompt_service),
) -> dict[str, int]:
    count = await service.wipe_and_reset_builtin_prompts()
    return {"recreated": count}
