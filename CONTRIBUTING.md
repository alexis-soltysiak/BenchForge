# Contributing

## Principles

- Keep pull requests small and focused.
- Preserve strong typing across backend and frontend.
- Follow the feature boundaries described in `docs/03-architecture.md`.
- Add tests alongside new backend service and API logic.
- Include UI screenshots for visual frontend changes.

## Local setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install backend dependencies with `cd backend && uv sync`.
4. Apply migrations with `cd backend && uv run alembic upgrade head`.
5. Install frontend dependencies with `cd frontend && npm install`.

For the end-to-end first-run workflow and the regular day-to-day startup flow,
use the repository root [README.md](/Users/alexis/Documents/GitHub/BenchForge/README.md:1).

## Development workflow

- Backend entrypoint: `backend/app/main.py`
- Frontend entrypoint: `frontend/src/main.tsx`
- Prefer migrations for schema changes once Alembic is introduced in PR 002.
- Never commit real secrets.
- Keep generated reports and artifacts outside the repo by default.

## Quality gates

### Backend

- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run mypy app`
- `uv run pytest`

### Frontend

- `npm run lint`
- `npm run build`
- `npm run format:check`
