from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any


@dataclass
class AdapterExecutionResult:
    request_payload: dict[str, Any]
    raw_response_json: Any
    raw_response_text: str
    normalized_response_text: str
    duration_ms: int
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    tokens_per_second: Decimal | None
    estimated_cost: Decimal | None
    extra_metrics: dict[str, Any] | None


class BaseInferenceAdapter:
    async def generate(
        self,
        *,
        endpoint_url: str,
        model_identifier: str,
        prompt_text: str,
        system_prompt_text: str | None,
        secret: str | None,
        timeout_seconds: int,
        pricing_input_per_million: str | None,
        pricing_output_per_million: str | None,
    ) -> AdapterExecutionResult:
        raise NotImplementedError

