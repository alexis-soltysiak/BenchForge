"""Subprocess-based Python code executor for code_generation prompts."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import textwrap


def run_code_tests(response_text: str, hidden_tests: list[dict]) -> int:
    """Run hidden unit tests against code extracted from a model response.

    Returns:
        2 — all hidden tests passed
        1 — code ran but at least one test failed
        0 — no runnable code, syntax error, timeout, or any other exception
    """
    if not hidden_tests or not isinstance(hidden_tests, list):
        return 0

    valid_tests = [
        tc for tc in hidden_tests
        if isinstance(tc, dict) and "fn" in tc and "args" in tc and "expected" in tc
    ]
    if not valid_tests:
        return 0

    code = _extract_python_block(response_text)
    harness = _build_harness(code, valid_tests)

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".py",
            delete=False,
            encoding="utf-8",
        ) as tmp:
            tmp.write(harness)
            tmp_path = tmp.name

        result = subprocess.run(
            [sys.executable, tmp_path],
            timeout=10,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return 0

        try:
            data = json.loads(result.stdout)
        except (json.JSONDecodeError, ValueError):
            return 0

        passed_list = data.get("passed", [])
        if not isinstance(passed_list, list) or not passed_list:
            return 0
        if all(passed_list):
            return 2
        return 1
    except subprocess.TimeoutExpired:
        return 0
    except Exception:
        return 0
    finally:
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def _extract_python_block(text: str) -> str:
    """Return the first ```python ... ``` fenced code block, or the whole text.

    Uses newline-terminated end marker to avoid matching the opening fence
    of a subsequent fenced block.
    """
    start_marker = "```python"
    start = text.find(start_marker)
    if start == -1:
        return text
    code_start = start + len(start_marker)
    # Require the closing ``` to be at the start of a line (preceded by \n)
    end = text.find("\n```", code_start)
    if end == -1:
        return text[code_start:]
    return text[code_start:end]


def _build_harness(code: str, hidden_tests: list[dict]) -> str:
    """Build a self-contained Python harness script."""
    tests_json = json.dumps(hidden_tests)
    harness = textwrap.dedent(f"""\
        import json as _json

        _namespace = {{}}
        try:
            exec({code!r}, _namespace)
        except Exception as _exc:
            print(_json.dumps({{"passed": [], "error": str(_exc)}}))
            raise SystemExit(1)

        _tests = _json.loads({tests_json!r})
        _passed = []
        for _tc in _tests:
            try:
                _fn = _namespace[_tc["fn"]]
                _args = _tc.get("args", [])
                _kwargs = _tc.get("kwargs", {{}})
                _result = _fn(*_args, **_kwargs)
                _passed.append(_result == _tc["expected"])
            except Exception:
                _passed.append(False)

        print(_json.dumps({{"passed": _passed}}))
    """)
    return harness
