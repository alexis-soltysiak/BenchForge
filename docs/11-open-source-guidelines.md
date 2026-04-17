# Open Source Guidelines

## Repository philosophy

This project should be easy to clone, run locally, understand, and contribute to.

## Suggested repo structure

```text
backend/
frontend/
docs/
docker/
scripts/
```

## Tooling suggestions

### Backend

- uv
- ruff
- mypy
- pytest
- alembic

### Frontend

- TypeScript
- ESLint
- Prettier
- Tailwind
- ShadCN/UI

## Contribution standards

- Small, focused pull requests
- Strong typing on backend and frontend
- Clear feature boundaries
- Migration per schema change
- Tests for service and API logic
- Screenshots for UI PRs

## Operational notes

- Use `.env.example`
- Never commit real secrets
- Use encrypted local secret storage in PostgreSQL
- Keep reports and artifacts outside the repo by default

## Licensing

A permissive license such as MIT or Apache-2.0 is recommended for broad adoption.
