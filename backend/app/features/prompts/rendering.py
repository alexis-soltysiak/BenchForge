from __future__ import annotations

import json
from typing import Any, Protocol


class ScenarioPrompt(Protocol):
    user_prompt_text: str
    objective: str | None
    context: str | None
    input_artifacts_jsonb: list[dict[str, Any]] | None
    constraints_jsonb: dict[str, Any] | list[Any] | None
    expected_output_format: str | None


def render_scenario_prompt(prompt: ScenarioPrompt) -> str:
    sections: list[tuple[str, str]] = []
    if prompt.objective:
        sections.append(("Objective", prompt.objective.strip()))
    if prompt.context:
        sections.append(("Context", prompt.context.strip()))
    if prompt.input_artifacts_jsonb:
        sections.append(("Artifacts", _render_artifacts(prompt.input_artifacts_jsonb)))
    if prompt.constraints_jsonb:
        sections.append(("Constraints", _render_jsonish(prompt.constraints_jsonb)))
    if prompt.expected_output_format:
        sections.append(("Expected output format", prompt.expected_output_format.strip()))

    sections = [(title, content) for title, content in sections if content]
    if not sections:
        return prompt.user_prompt_text.strip()

    if prompt.user_prompt_text.strip():
        sections.append(("Task", prompt.user_prompt_text.strip()))
    return "\n\n".join(f"## {title}\n{content}" for title, content in sections)


def _render_artifacts(artifacts: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for artifact in artifacts:
        name = str(artifact.get("name") or "artifact")
        kind = str(artifact.get("kind") or "document")
        language = artifact.get("language")
        content = str(artifact.get("content") or "")
        header = f"### {name} ({kind}{f', {language}' if language else ''})"
        blocks.append(f"{header}\n```{language or ''}\n{content}\n```")
    return "\n\n".join(blocks)


def _render_jsonish(value: dict[str, Any] | list[Any]) -> str:
    if isinstance(value, list):
        return "\n".join(f"- {item}" for item in value)
    if all(isinstance(item, str) for item in value.values()):
        return "\n".join(f"- {key}: {item}" for key, item in value.items())
    return json.dumps(value, ensure_ascii=False, indent=2)
