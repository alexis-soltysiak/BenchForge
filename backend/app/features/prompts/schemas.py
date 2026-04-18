from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PromptCategoryRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    is_system: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromptRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    category: PromptCategoryRead
    system_prompt_text: str | None
    user_prompt_text: str
    evaluation_notes: str | None
    tags: list[str]
    is_active: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class PromptCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category_id: int
    system_prompt_text: str | None = None
    user_prompt_text: str = Field(min_length=1)
    evaluation_notes: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_active: bool = True


class PromptUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category_id: int | None = None
    system_prompt_text: str | None = None
    user_prompt_text: str | None = Field(default=None, min_length=1)
    evaluation_notes: str | None = None
    tags: list[str] | None = None
    is_active: bool | None = None


class PromptListResponse(BaseModel):
    items: list[PromptRead]
    total: int

