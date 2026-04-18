#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../backend"
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port "${BACKEND_PORT:-8000}"

