from __future__ import annotations

import json
import time
from decimal import Decimal
from typing import Any

import httpx

from app.features.execution.adapters.base import (
    AdapterExecutionResult,
    BaseInferenceAdapter,
)

ANTHROPIC_API_VERSION = "2023-06-01"
DEFAULT_MAX_TOKENS = 4096


class AnthropicAdapter(BaseInferenceAdapter):
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
        request_payload: dict[str, Any] = {
            "model": model_identifier,
            "max_tokens": DEFAULT_MAX_TOKENS,
            "messages": [{"role": "user", "content": prompt_text}],
        }
        if system_prompt_text:
            request_payload["system"] = system_prompt_text

        headers = {
            "Content-Type": "application/json",
            "anthropic-version": ANTHROPIC_API_VERSION,
        }
        if secret:
            headers["x-api-key"] = secret

        started = time.perf_counter()
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                endpoint_url, json=request_payload, headers=headers
            )
            response.raise_for_status()
        duration_ms = int((time.perf_counter() - started) * 1000)

        data = response.json()
        text = _extract_text(data.get("content"))
        usage = data.get("usage") or {}
        input_tokens = usage.get("input_tokens")
        output_tokens = usage.get("output_tokens")
        total_tokens = (
            input_tokens + output_tokens
            if input_tokens is not None and output_tokens is not None
            else input_tokens if output_tokens is None else output_tokens
        )
        tokens_per_second = (
            Decimal(output_tokens) / (Decimal(duration_ms) / Decimal(1000))
            if output_tokens is not None and duration_ms > 0
            else None
        )
        estimated_cost = _estimate_cost(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            pricing_input_per_million=pricing_input_per_million,
            pricing_output_per_million=pricing_output_per_million,
        )
        return AdapterExecutionResult(
            request_payload=request_payload,
            raw_response_json=data,
            raw_response_text=json.dumps(data),
            normalized_response_text=text.strip(),
            duration_ms=duration_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            tokens_per_second=tokens_per_second,
            estimated_cost=estimated_cost,
            extra_metrics={
                "status_code": response.status_code,
                "stop_reason": data.get("stop_reason"),
            },
        )


def _extract_text(content: object) -> str:
    if not isinstance(content, list):
        return ""

    parts = [
        str(block.get("text", "")).strip()
        for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    return "\n".join(part for part in parts if part)


def _estimate_cost(
    *,
    input_tokens: int | None,
    output_tokens: int | None,
    pricing_input_per_million: str | None,
    pricing_output_per_million: str | None,
) -> Decimal | None:
    has_pricing = (
        pricing_input_per_million is not None or pricing_output_per_million is not None
    )
    if not has_pricing:
        return None
    if input_tokens is None and output_tokens is None:
        return None
    total = Decimal("0")
    if input_tokens is not None and pricing_input_per_million is not None:
        total += (Decimal(input_tokens) / Decimal(1_000_000)) * Decimal(
            pricing_input_per_million
        )
    if output_tokens is not None and pricing_output_per_million is not None:
        total += (Decimal(output_tokens) / Decimal(1_000_000)) * Decimal(
            pricing_output_per_million
        )
    return total
