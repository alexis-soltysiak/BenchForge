from __future__ import annotations

import json
import time
from decimal import Decimal

import httpx

from app.core.security import build_bearer_token
from app.features.execution.adapters.base import AdapterExecutionResult, BaseInferenceAdapter


class OpenAICompatibleAdapter(BaseInferenceAdapter):
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
        request_payload = {
            "model": model_identifier,
            "messages": [
                *(
                    [{"role": "system", "content": system_prompt_text}]
                    if system_prompt_text
                    else []
                ),
                {"role": "user", "content": prompt_text},
            ],
        }
        headers = {"Content-Type": "application/json"}
        if secret:
            headers["Authorization"] = build_bearer_token(secret)

        started = time.perf_counter()
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(endpoint_url, json=request_payload, headers=headers)
            response.raise_for_status()
        duration_ms = int((time.perf_counter() - started) * 1000)

        data = response.json()
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        text = str(message.get("content") or choice.get("text") or "")
        usage = data.get("usage") or {}
        input_tokens = usage.get("prompt_tokens")
        output_tokens = usage.get("completion_tokens")
        total_tokens = usage.get("total_tokens")
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
            extra_metrics={"status_code": response.status_code},
        )


def _estimate_cost(
    *,
    input_tokens: int | None,
    output_tokens: int | None,
    pricing_input_per_million: str | None,
    pricing_output_per_million: str | None,
) -> Decimal | None:
    if input_tokens is None and output_tokens is None:
        return None
    total = Decimal("0")
    if input_tokens is not None and pricing_input_per_million is not None:
        total += (Decimal(input_tokens) / Decimal(1_000_000)) * Decimal(pricing_input_per_million)
    if output_tokens is not None and pricing_output_per_million is not None:
        total += (Decimal(output_tokens) / Decimal(1_000_000)) * Decimal(pricing_output_per_million)
    return total

