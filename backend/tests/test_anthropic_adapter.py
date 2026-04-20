from decimal import Decimal

import pytest

from app.features.execution.adapters.anthropic import AnthropicAdapter


class DummyResponse:
    status_code = 200

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return {
            "content": [
                {"type": "text", "text": "Hello"},
                {"type": "tool_use", "id": "toolu_123"},
                {"type": "text", "text": "world"},
            ],
            "usage": {"input_tokens": 11, "output_tokens": 7},
            "stop_reason": "end_turn",
        }


class DummyAsyncClient:
    def __init__(self, *args, **kwargs) -> None:
        self.timeout = kwargs.get("timeout")

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def post(self, url: str, json: dict[str, object], headers: dict[str, str]):
        assert url == "https://api.anthropic.com/v1/messages"
        assert json == {
            "model": "claude-sonnet-4-6",
            "max_tokens": 4096,
            "system": "System prompt",
            "messages": [{"role": "user", "content": "User prompt"}],
        }
        assert headers["x-api-key"] == "secret"
        assert headers["anthropic-version"] == "2023-06-01"
        return DummyResponse()


@pytest.mark.asyncio
async def test_anthropic_adapter_normalizes_text_and_usage(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.features.execution.adapters.anthropic.httpx.AsyncClient",
        DummyAsyncClient,
    )

    result = await AnthropicAdapter().generate(
        endpoint_url="https://api.anthropic.com/v1/messages",
        model_identifier="claude-sonnet-4-6",
        prompt_text="User prompt",
        system_prompt_text="System prompt",
        secret="secret",
        timeout_seconds=30,
        pricing_input_per_million="3",
        pricing_output_per_million="15",
    )

    assert result.normalized_response_text == "Hello\nworld"
    assert result.input_tokens == 11
    assert result.output_tokens == 7
    assert result.total_tokens == 18
    assert result.estimated_cost == Decimal("0.000138")
    assert result.extra_metrics == {"status_code": 200, "stop_reason": "end_turn"}
