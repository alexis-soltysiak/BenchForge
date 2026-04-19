from datetime import datetime

from pydantic import BaseModel, Field


class ApiKeyPresetRead(BaseModel):
    id: int
    name: str
    provider_type: str
    has_secret: bool
    secret_preview: str | None
    created_at: datetime
    updated_at: datetime


class ApiKeyPresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    provider_type: str = Field(min_length=1, max_length=64)
    secret: str = Field(min_length=1)


class ApiKeyPresetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    provider_type: str | None = Field(default=None, min_length=1, max_length=64)
    secret: str | None = None


class ApiKeyPresetListResponse(BaseModel):
    items: list[ApiKeyPresetRead]
    total: int
