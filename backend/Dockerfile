FROM python:3.12-slim

WORKDIR /app

# Base fonts for Chromium text rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./

# Sync Python dependencies (updates lock file if pyproject.toml changed)
RUN uv sync

# Download Chromium browser and install all its OS-level dependencies.
# The binary lands in /root/.cache/ms-playwright (image layer), which
# persists independently of the backend_venv named volume.
RUN uv run playwright install --with-deps chromium
