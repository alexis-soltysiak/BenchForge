from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class BuiltinPromptSeed:
    slug: str
    name: str
    category_slug: str
    description: str
    user_prompt_text: str
    evaluation_notes: str | None
    tags: tuple[str, ...]
    system_prompt_text: str | None = None
    difficulty: int | None = None
    scenario_type: str | None = None
    objective: str | None = None
    context: str | None = None
    input_artifacts_jsonb: tuple[dict[str, Any], ...] = field(default_factory=tuple)
    constraints_jsonb: dict[str, Any] | list[Any] | None = None
    expected_behavior_jsonb: dict[str, Any] | list[Any] | None = None
    gold_facts_jsonb: dict[str, Any] | None = None
    judge_rubric_jsonb: dict[str, Any] | None = None
    estimated_input_tokens: int | None = None
    expected_output_format: str | None = None
    cost_tier: str | None = "low"
    weight: int | None = 1
    version: str | None = "1.0"
    test_cases_visible: tuple[dict, ...] | None = None
    test_cases_hidden: tuple[dict, ...] | None = None


def rubric(*keys: str) -> dict[str, Any]:
    weight = max(1, 100 // max(1, len(keys)))
    return {
        "criteria": [
            {"key": key, "label": key.replace("_", " ").title(), "weight": weight, "description": f"Evaluate {key.replace('_', ' ')}."}
            for key in keys
        ],
        "penalties": [
            {"key": "hallucination", "weight": -20, "description": "Penalize facts, files, or constraints not supported by the scenario."},
            {"key": "verbosity", "weight": -10, "description": "Penalize padded answers that do not add useful information."},
        ],
    }


COMMON_GOLD_FACTS: dict[str, list[str]] = {
    "must_include": [],
    "must_not_include": [],
    "acceptable_solutions": [],
    "common_failure_modes": [],
}
