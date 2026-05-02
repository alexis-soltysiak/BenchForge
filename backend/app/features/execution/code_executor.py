"""Subprocess-based Python code executor for code_generation prompts."""
from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tempfile
import textwrap

import docker

from app.core.logging import get_logger

logger = get_logger(__name__)

SANDBOX_IMAGE = "python:3.12-slim"
SANDBOX_MEMORY_LIMIT = "128m"
SANDBOX_PYTEST_IMAGE = "benchforge-sandbox:pytest"


def ensure_pytest_sandbox_image() -> None:
    """Build the pytest sandbox image if it is not already present."""
    dockerfile = b"FROM python:3.12-slim\nRUN pip install pytest --no-cache-dir\n"
    try:
        client = docker.from_env()
        try:
            client.images.get(SANDBOX_PYTEST_IMAGE)
        except docker.errors.ImageNotFound:
            client.images.build(
                fileobj=io.BytesIO(dockerfile),
                tag=SANDBOX_PYTEST_IMAGE,
                rm=True,
            )
    except Exception as exc:
        logger.warning("Could not ensure pytest sandbox image: %s", exc)


def run_code_tests(response_text: str, hidden_tests: list[dict]) -> int:
    """Run hidden unit tests against code extracted from a model response.

    Returns:
        2 — all hidden tests passed
        1 — code ran but at least one test failed
        0 — no runnable code, syntax error, timeout, or any other exception
    """
    if not hidden_tests or not isinstance(hidden_tests, list):
        return 0

    pytest_tests = [
        tc for tc in hidden_tests
        if isinstance(tc, dict) and tc.get("type") == "pytest" and "code" in tc
    ]
    fn_tests = [
        tc for tc in hidden_tests
        if isinstance(tc, dict) and "fn" in tc and "args" in tc and "expected" in tc
    ]

    code = _extract_python_block(response_text)

    if pytest_tests:
        try:
            return _run_with_pytest(code, pytest_tests)
        except Exception as exc:
            logger.warning("Pytest executor failed: %s", exc)
            return 0

    if not fn_tests:
        return 0

    harness = _build_harness(code, fn_tests)
    try:
        return _run_with_docker(harness)
    except Exception as exc:
        logger.warning("Docker unavailable, falling back to subprocess: %s", exc)
        return _run_with_subprocess(harness)


def _run_with_docker(harness: str) -> int:
    """Run harness in an isolated Docker container.

    Raises on Docker infrastructure failure; returns 0/1/2 on execution result.
    """
    client = docker.from_env()
    container = client.containers.create(
        SANDBOX_IMAGE,
        ["python", "-c", harness],
        network_disabled=True,
        mem_limit=SANDBOX_MEMORY_LIMIT,
    )
    try:
        container.start()
        try:
            result = container.wait(timeout=10)
        except Exception:
            try:
                container.kill()
            except Exception:
                pass
            return 0
        if result["StatusCode"] != 0:
            return 0
        try:
            output = container.logs(stdout=True, stderr=False)
        except Exception:
            return 0
        try:
            data = json.loads(output)
        except (json.JSONDecodeError, ValueError):
            return 0
        passed_list = data.get("passed", [])
        if not isinstance(passed_list, list) or not passed_list:
            return 0
        return 2 if all(passed_list) else 1
    finally:
        try:
            container.remove(force=True)
        except Exception:
            pass


def _run_with_pytest(code: str, pytest_tests: list[dict]) -> int:
    """Run pytest-style tests against extracted code in the pytest sandbox container.

    Raises on Docker infrastructure failure; returns 0/1/2 on execution result.
    """
    test_code = "\n\n".join(tc["code"] for tc in pytest_tests)
    harness = textwrap.dedent(f"""\
        import json as _json
        import os as _os
        import subprocess as _subprocess
        import sys as _sys
        import tempfile as _tempfile

        _tmpdir = _tempfile.mkdtemp()
        with open(_os.path.join(_tmpdir, "solution.py"), "w", encoding="utf-8") as _f:
            _f.write({code!r})
        with open(_os.path.join(_tmpdir, "test_solution.py"), "w", encoding="utf-8") as _f:
            _f.write({test_code!r})

        _result = _subprocess.run(
            [_sys.executable, "-m", "pytest", "test_solution.py", "-q", "--tb=no", "--no-header"],
            cwd=_tmpdir,
            capture_output=True,
        )
        print(_json.dumps({{"passed": [_result.returncode == 0]}}))
        _sys.exit(_result.returncode)
    """)

    client = docker.from_env()
    container = client.containers.create(
        SANDBOX_PYTEST_IMAGE,
        ["python", "-c", harness],
        network_disabled=True,
        mem_limit=SANDBOX_MEMORY_LIMIT,
    )
    try:
        container.start()
        try:
            result = container.wait(timeout=60)
        except Exception:
            try:
                container.kill()
            except Exception:
                pass
            return 0
        if result["StatusCode"] != 0:
            return 1
        try:
            output = container.logs(stdout=True, stderr=False)
        except Exception:
            return 1
        try:
            data = json.loads(output)
        except (json.JSONDecodeError, ValueError):
            return 1
        passed_list = data.get("passed", [])
        if not isinstance(passed_list, list) or not passed_list:
            return 1
        return 2 if all(passed_list) else 1
    finally:
        try:
            container.remove(force=True)
        except Exception:
            pass


def _run_with_subprocess(harness: str) -> int:
    """Run harness in a local subprocess (fallback when Docker is unavailable)."""
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
