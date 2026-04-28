from datetime import datetime
from typing import Any

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
    scenario_type: str | None = None
    benchmark_type: str | None = None
    objective: str | None = None
    context: str | None = None
    input_artifacts_jsonb: list[dict[str, Any]] | None = None
    constraints_jsonb: dict[str, Any] | list[Any] | None = None
    expected_behavior_jsonb: dict[str, Any] | list[Any] | None = None
    gold_facts_jsonb: dict[str, Any] | None = None
    judge_rubric_jsonb: dict[str, Any] | None = None
    estimated_input_tokens: int | None = None
    expected_output_format: str | None = None
    cost_tier: str | None = None
    weight: int | None = None
    version: str | None = None
    tags: list[str]
    difficulty: int | None = None
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
    scenario_type: str | None = Field(default=None, max_length=80)
    benchmark_type: str | None = Field(default=None, max_length=80)
    objective: str | None = None
    context: str | None = None
    input_artifacts_jsonb: list[dict[str, Any]] | None = None
    constraints_jsonb: dict[str, Any] | list[Any] | None = None
    expected_behavior_jsonb: dict[str, Any] | list[Any] | None = None
    gold_facts_jsonb: dict[str, Any] | None = None
    judge_rubric_jsonb: dict[str, Any] | None = None
    estimated_input_tokens: int | None = Field(default=None, ge=0)
    expected_output_format: str | None = None
    cost_tier: str | None = Field(default=None, max_length=32)
    weight: int | None = Field(default=1, ge=1)
    version: str | None = Field(default="1.0", max_length=64)
    tags: list[str] = Field(default_factory=list)
    difficulty: int | None = Field(default=None, ge=1, le=5)
    is_active: bool = True


class PromptUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category_id: int | None = None
    system_prompt_text: str | None = None
    user_prompt_text: str | None = Field(default=None, min_length=1)
    evaluation_notes: str | None = None
    scenario_type: str | None = Field(default=None, max_length=80)
    benchmark_type: str | None = Field(default=None, max_length=80)
    objective: str | None = None
    context: str | None = None
    input_artifacts_jsonb: list[dict[str, Any]] | None = None
    constraints_jsonb: dict[str, Any] | list[Any] | None = None
    expected_behavior_jsonb: dict[str, Any] | list[Any] | None = None
    gold_facts_jsonb: dict[str, Any] | None = None
    judge_rubric_jsonb: dict[str, Any] | None = None
    estimated_input_tokens: int | None = Field(default=None, ge=0)
    expected_output_format: str | None = None
    cost_tier: str | None = Field(default=None, max_length=32)
    weight: int | None = Field(default=None, ge=1)
    version: str | None = Field(default=None, max_length=64)
    tags: list[str] | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    is_active: bool | None = None


class PromptListResponse(BaseModel):
    items: list[PromptRead]
    total: int
