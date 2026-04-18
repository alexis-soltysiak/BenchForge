from __future__ import annotations

import json
import time

import httpx

from app.core.security import build_bearer_token
from app.features.execution.adapters.base import AdapterExecutionResult, BaseInferenceAdapter


class HuggingFaceAdapter(BaseInferenceAdapter):
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
        full_prompt = f"{system_prompt_text}\n\n{prompt_text}" if system_prompt_text else prompt_text
        request_payload = {"inputs": full_prompt, "parameters": {"return_full_text": False}}
        headers = {"Content-Type": "application/json"}
        if secret:
            headers["Authorization"] = build_bearer_token(secret)

        started = time.perf_counter()
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(endpoint_url, json=request_payload, headers=headers)
            response.raise_for_status()
        duration_ms = int((time.perf_counter() - started) * 1000)

        data = response.json()
        generated_text = ""
        if isinstance(data, list) and data and isinstance(data[0], dict):
            generated_text = str(data[0].get("generated_text", ""))
        return AdapterExecutionResult(
            request_payload=request_payload,
            raw_response_json=data,
            raw_response_text=json.dumps(data),
            normalized_response_text=generated_text.strip(),
            duration_ms=duration_ms,
            input_tokens=None,
            output_tokens=None,
            total_tokens=None,
            tokens_per_second=None,
            estimated_cost=None,
            extra_metrics={"status_code": response.status_code, "model": model_identifier},
        )

