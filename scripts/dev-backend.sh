#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" == "Darwin" ]]; then
  brew_libs=()
  for pkg in glib pango gobject-introspection harfbuzz fribidi fontconfig freetype libpng cairo; do
    pkg_prefix="$(brew --prefix "$pkg" 2>/dev/null || true)"
    if [[ -n "$pkg_prefix" && -d "$pkg_prefix/lib" ]]; then
      brew_libs+=("$pkg_prefix/lib")
    fi
  done

  if [[ ${#brew_libs[@]} -gt 0 ]]; then
    export DYLD_FALLBACK_LIBRARY_PATH="$(IFS=:; echo "${brew_libs[*]}")${DYLD_FALLBACK_LIBRARY_PATH:+:$DYLD_FALLBACK_LIBRARY_PATH}"
  fi
fi

cd "$(dirname "$0")/../backend"
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port "${BACKEND_PORT:-8000}"
