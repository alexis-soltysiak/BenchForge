from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class BuiltinModelProfileSeed:
    display_name: str
    role: str
    provider_type: str
    api_style: str
    runtime_type: str
    endpoint_url: str
    model_identifier: str
    timeout_seconds: int
    pricing_input_per_million: Decimal | None
    pricing_output_per_million: Decimal | None
    notes: str | None = None
    local_load_instructions: str | None = None
    is_active: bool = True
    secret: str | None = None


BUILTIN_MODEL_PROFILE_SEEDS: tuple[BuiltinModelProfileSeed, ...] = (
    BuiltinModelProfileSeed(
        display_name="gpt-5.4",
        role="both",
        provider_type="openai",
        api_style="openai_compatible",
        runtime_type="remote",
        endpoint_url="https://api.openai.com/v1/chat/completions",
        model_identifier="gpt-5.4-2026-03-05",
        timeout_seconds=300,
        pricing_input_per_million=Decimal("2.5000"),
        pricing_output_per_million=Decimal("15.0000"),
    ),
    BuiltinModelProfileSeed(
        display_name="Qwen 3.6 35B A3B - LM Studio Local",
        role="candidate",
        provider_type="lmstudio",
        api_style="openai_compatible",
        runtime_type="local",
        endpoint_url="http://127.0.0.1:1234/v1/chat/completions",
        model_identifier="qwen/qwen3.6-35b-a3b",
        timeout_seconds=300,
        pricing_input_per_million=Decimal("0"),
        pricing_output_per_million=Decimal("0"),
        local_load_instructions=(
            "Open LM Studio Developer server on http://127.0.0.1:1234, then load model "
            "qwen/qwen3.6-35b-a3b before confirming readiness."
        ),
    ),
    BuiltinModelProfileSeed(
        display_name="gpt-5.4-mini",
        role="both",
        provider_type="openai",
        api_style="openai_compatible",
        runtime_type="remote",
        endpoint_url="https://api.openai.com/v1/chat/completions",
        model_identifier="gpt-5.4-mini-2026-03-17",
        timeout_seconds=300,
        pricing_input_per_million=Decimal("0.7500"),
        pricing_output_per_million=Decimal("4.5000"),
        notes="Mini Model of chatgpt",
    ),
    BuiltinModelProfileSeed(
        display_name="gpt-5.4-nano",
        role="both",
        provider_type="openai",
        api_style="openai_compatible",
        runtime_type="remote",
        endpoint_url="https://api.openai.com/v1/chat/completions",
        model_identifier="gpt-5.4-nano",
        timeout_seconds=600,
        pricing_input_per_million=Decimal("0.2000"),
        pricing_output_per_million=Decimal("1.2500"),
    ),
)
