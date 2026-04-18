from datetime import datetime

from pydantic import BaseModel, Field


class SessionPromptItem(BaseModel):
    id: int
    prompt_id: int
    prompt_name: str
    display_order: int


class SessionModelItem(BaseModel):
    id: int
    model_profile_id: int
    display_name: str
    role: str
    runtime_type: str
    provider_type: str
    display_order: int


class SessionRead(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    max_candidates: int
    rubric_version: str
    prompts: list[SessionPromptItem]
    candidates: list[SessionModelItem]
    judges: list[SessionModelItem]
    created_at: datetime
    updated_at: datetime


class SessionListResponse(BaseModel):
    items: list[SessionRead]
    total: int


class SessionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: str = Field(default="draft", pattern="^(draft|ready|archived)$")
    max_candidates: int = Field(default=5, ge=1, le=5)
    rubric_version: str = Field(default="mvp-v1", min_length=1, max_length=64)


class SessionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(draft|ready|archived)$")
    max_candidates: int | None = Field(default=None, ge=1, le=5)
    rubric_version: str | None = Field(default=None, min_length=1, max_length=64)


class SessionPromptCreate(BaseModel):
    prompt_id: int
    display_order: int | None = Field(default=None, ge=1)


class SessionCandidateCreate(BaseModel):
    model_profile_id: int
    display_order: int | None = Field(default=None, ge=1)


class SessionJudgeCreate(BaseModel):
    model_profile_id: int
    display_order: int | None = Field(default=None, ge=1)

