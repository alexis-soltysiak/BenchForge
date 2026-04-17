# Architecture

## 1. Technical stack

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy 2.x
- Alembic
- Pydantic v2
- httpx
- PostgreSQL
- uv for dependency and environment management

### Frontend

- React
- TypeScript
- Vite or Next.js App Router
- ShadCN/UI
- TanStack Query
- Tailwind CSS

### Reporting

- HTML templating on backend or frontend-generated print view
- PDF export from HTML using a server-side or browser-based print pipeline

## 2. Architectural style

Feature-based backend architecture.

Suggested structure:

```text
app/
  core/
    config.py
    security.py
    database.py
    encryption.py
    logging.py
    errors.py
  features/
    prompts/
      api.py
      service.py
      repository.py
      schemas.py
      models.py
    models_registry/
      api.py
      service.py
      repository.py
      schemas.py
      models.py
    sessions/
      api.py
      service.py
      repository.py
      schemas.py
      models.py
    runs/
      api.py
      service.py
      repository.py
      schemas.py
      models.py
    execution/
      api.py
      service.py
      repository.py
      schemas.py
      adapters/
        base.py
        openai_compatible.py
        anthropic.py
        lm_studio.py
        huggingface.py
    judging/
      api.py
      service.py
      repository.py
      schemas.py
      models.py
    reports/
      api.py
      service.py
      repository.py
      schemas.py
      templates/
    metrics/
      service.py
      repository.py
      schemas.py
  main.py
```

## 3. Core design choices

### Session vs Run separation

Sessions are editable benchmark configurations.
Runs are immutable execution records.

### Shared model registry

Candidate models and judge models live in one registry table with role markers.

### Snapshot-on-launch

At run launch, the product must snapshot all referenced prompts and models.

### Hybrid execution engine

The execution layer must handle:

- remote asynchronous calls
- guided local operator steps
- retries for remote failures
- stateful progress tracking

## 4. Why PostgreSQL

PostgreSQL is selected over SQLite because the project is intended as a serious open-source benchmark platform with room for:

- richer analytics
- more advanced aggregation queries
- future background job coordination
- better extensibility for later versions

## 5. Execution architecture

### MVP

- FastAPI async backend
- state persisted in PostgreSQL
- no Redis/Celery initially
- simple state machine for run steps

### Future

- optional queue integration
- distributed worker support
- parallel runs

## 6. Provider adapter strategy

Use an adapter abstraction:

- `BaseInferenceAdapter`
- `OpenAICompatibleAdapter`
- `AnthropicAdapter`
- `LMStudioAdapter`
- `HuggingFaceAdapter`

Each adapter should normalize:

- request payload construction
- auth handling
- token/usage extraction
- latency metrics extraction
- response text normalization
- error normalization

## 7. Security

- secrets encrypted at rest in PostgreSQL
- encryption key from environment
- secrets never returned in full to frontend
- mask secret values in UI

## 8. Frontend architecture

Suggested feature structure:

```text
src/
  components/
  features/
    prompts/
    models/
    sessions/
    runs/
    reports/
  lib/
    api.ts
    query-client.ts
    utils.ts
  routes/
  app/
```

## 9. Report generation strategy

Preferred approach:

- generate a polished HTML report view first
- allow PDF export via print or rendering pipeline
- keep the HTML report as the source of truth
