from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ModelProfileRead(BaseModel):
    id: int
    display_name: str
    slug: str
    role: str
    provider_type: str
    api_style: str
    runtime_type: str
    machine_label: str | None
    endpoint_url: str
    model_identifier: str
    secret_masked: str | None
    timeout_seconds: int
    context_window: int | None
    pricing_input_per_million: Decimal | None
    pricing_output_per_million: Decimal | None
    notes: str | None
    local_load_instructions: str | None
    is_active: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class ModelProfileCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    role: str = Field(pattern="^(candidate|judge|both)$")
    provider_type: str = Field(min_length=1, max_length=64)
    api_style: str = Field(min_length=1, max_length=64)
    runtime_type: str = Field(pattern="^(remote|local)$")
    machine_label: str | None = Field(default=None, max_length=200)
    endpoint_url: str = Field(min_length=1, max_length=500)
    model_identifier: str = Field(min_length=1, max_length=255)
    secret: str | None = None
    timeout_seconds: int = Field(default=60, ge=1, le=3600)
    context_window: int | None = Field(default=None, ge=1)
    pricing_input_per_million: Decimal | None = Field(default=None, ge=0)
    pricing_output_per_million: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None
    local_load_instructions: str | None = None
    is_active: bool = True


class ModelProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = Field(default=None, pattern="^(candidate|judge|both)$")
    provider_type: str | None = Field(default=None, min_length=1, max_length=64)
    api_style: str | None = Field(default=None, min_length=1, max_length=64)
    runtime_type: str | None = Field(default=None, pattern="^(remote|local)$")
    machine_label: str | None = Field(default=None, max_length=200)
    endpoint_url: str | None = Field(default=None, min_length=1, max_length=500)
    model_identifier: str | None = Field(default=None, min_length=1, max_length=255)
    secret: str | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=3600)
    context_window: int | None = Field(default=None, ge=1)
    pricing_input_per_million: Decimal | None = Field(default=None, ge=0)
    pricing_output_per_million: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None
    local_load_instructions: str | None = None
    is_active: bool | None = None


class ModelProfileListResponse(BaseModel):
    items: list[ModelProfileRead]
    total: int


class ModelProfileConnectionTestResponse(BaseModel):
    ok: bool
    status_code: int | None
    detail: str


class ModelProfileConnectionTestRequest(BaseModel):
    timeout_seconds: int | None = Field(default=None, ge=1, le=3600)
