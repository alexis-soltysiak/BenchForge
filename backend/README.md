# Backend

FastAPI backend for BenchForge.

For the complete local setup flow, including PostgreSQL, migrations, frontend,
and first MVP test steps, use the repository root README:
[README.md](/Users/alexis/Documents/GitHub/BenchForge/README.md:1).

## Local backend workflow

1. Install dependencies:

   ```bash
   uv sync
   ```

2. Apply migrations:

   ```bash
   uv run alembic upgrade head
   ```

3. Start the API:

   ```bash
   uv run uvicorn app.main:app --reload
   ```

Or from the repository root:

```bash
./scripts/dev-backend.sh
```

## Backend scope

- application settings
- database engine and async session factory
- SQLAlchemy declarative base
- Alembic migration scaffold
- logging, security, and encryption helpers
- prompt library backend feature
- model registry backend feature
- sessions backend feature
- run snapshot backend feature
- remote execution engine
- API router registration
- health and root endpoints
- feature-based package layout starter
- linting, typing, and test configuration

## Commands

```bash
uv sync
uv run alembic revision -m "create table"
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
uv run ruff check .
uv run mypy app
uv run pytest
```
