# BenchForge — CLAUDE.md

LLM benchmarking platform. Users build sessions (prompt set + model set), launch runs, observe execution in real time, and read scored reports.

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLAlchemy 2, PostgreSQL 17, Alembic, uv |
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind 3, React Query 5 |
| Infra | Docker Compose; tecnativa/docker-socket-proxy for sandboxed code execution |

## Running the stack

```bash
# First run
cp .env.example .env   # fill in DB credentials and API keys
docker compose up -d

# Rebuild after dependency changes
docker compose up -d --build backend
docker compose up -d --build frontend

# Restart a single service
docker compose restart backend

# Logs
docker compose logs -f backend
docker compose logs -f frontend
```

Backend: http://localhost:8000 — Frontend: http://localhost:5173

Alembic migrations run automatically at backend startup (`alembic upgrade head`).

## Backend development

```bash
cd backend

# Run tests
uv run python -m pytest tests/ -x -q

# Type-check
uv run mypy app/

# Lint / format
uv run ruff check app/
uv run ruff format app/

# Compile-check specific files
python3 -B -m py_compile app/features/runs/schemas.py app/features/runs/service.py
```

Feature layout: `app/features/<feature>/{models,schemas,api,service,repository}.py`

## Frontend development

```bash
cd frontend

# Type-check
npx tsc --noEmit

# Lint
npm run lint

# Format
npm run format
```

UI components live in `src/components/ui/` — only: `badge`, `button`, `card`, `input`, `textarea`, `select`, `modal`, `metric-card`, `load-error-state`. No Sheet/Drawer component exists; use Modal for overlays.

## Database migrations

```bash
cd backend
# Create a new migration
uv run alembic revision --autogenerate -m "description"
# Apply
uv run alembic upgrade head
# Roll back one step
uv run alembic downgrade -1
```

Migration naming convention: `YYYYMMDD_NNNN_description.py` (e.g. `20260502_0015_add_sample_index_to_candidate_response.py`).

When creating a unique index on a column that gets a `DEFAULT` backfill, always add a `DELETE` deduplication step first — see migration 0015 for the pattern.

## Architecture decisions

### Code execution sandbox
Code-generation prompts are executed inside Docker containers (not subprocess). The backend connects to Docker via `DOCKER_HOST=tcp://docker-proxy:2375` — a tecnativa/docker-socket-proxy that restricts the API surface.

Proxy env vars that must be set (`docker-compose.yml`):
- `CONTAINERS: 1` — path allow-list for container operations
- `IMAGES: 1` — path allow-list for image operations
- `BUILD: 1` — path allow-list for build
- `POST: 1` — **required** to pass HAProxy's method gate (`http-request deny unless METH_GET || { env(POST) -m bool }`); without this, all POST/DELETE methods are blocked regardless of path rules
- `PING: 1` and `VERSION: 1` — needed for docker-py client initialization

The pytest sandbox image (`benchforge-sandbox:pytest`) is built at backend startup via `ensure_pytest_sandbox_image()` in `app/features/execution/code_executor.py`. If it's missing, restart the backend.

Two executors exist in `code_executor.py`:
- `_run_with_docker` — plain Python execution (uses `python:3.12-slim`)
- `_run_with_pytest` — pytest harness execution (uses `benchforge-sandbox:pytest`); has a 512 KB harness size guard; has a `_wait_or_kill` timer killswitch for docker-py timeout reliability

### pass@k scoring
For `code_generation` prompts, the model is called **k=5 times independently** (fresh calls, no feedback between samples). Each call produces a separate `candidate_response` row with `sample_index` 0–4 and a unique index on `(prompt_snapshot_id, model_snapshot_id, sample_index)`.

Rates are computed in `compute_pass_at_k` in `app/features/runs/service.py`:
- **pass@1** — sample_index=0 passed (execution_tier > 0)
- **pass@3** — any of samples 0–2 passed
- **pass@5** — any of samples 0–4 passed
- **Iteration Potential** = pass@5 − pass@1

Denominator = total number of code_gen prompts in the run (not just prompts that have responses).

### Difficulty breakdown
`compute_pass_at_k` accepts a `difficulties: dict[source_prompt_id → int | None]` param (`diff_map` from `serialize_run`). It produces a per-model `difficulty_breakdown` list (pass@1 rate per difficulty tier, sorted ascending). Prompts with `difficulty=None` are excluded from breakdown but counted in aggregate rates. No extra DB query — piggybacks the existing `diff_map`.

### Sampling modes for code_generation
Code-generation prompts support two `sampling_mode` values (set per-prompt in the prompt editor):
- **`independent`** (default) — k=5 fresh API calls dispatched in parallel; measures raw generation ceiling
- **`iterative`** — k=5 sequential calls where each attempt receives the previous code + execution feedback; measures self-correction ability

Both modes produce the same 5 `candidate_response` rows. pass@k math is identical. Iterative chains run in `_execute_iterative_chain` in `execution/service.py`; early-stopping marks remaining samples `completed` with `error_message="Skipped — attempt N passed."`. The prompt editor selects the mode; `SessionRunPromptSnapshot.sampling_mode` captures it at launch time.

### Judging
Non-code-generation prompts are judged by an LLM judge (rubric-based scoring). Code-generation prompts skip judging (`judge_rubric_jsonb=None`) and are scored by execution tier instead.

`_effective_candidate_responses` in `judging/service.py` collapses multi-sample rows by preferring sample_index=0 to avoid scoring the wrong sample in mixed runs.

### Prompt seeds
Built-in prompts live in `app/features/prompts/builtin_seed.py` (non-code-gen) and `app/features/prompts/swe_bench_seeds.py` (SWE-bench code-gen seeds). Both import from `app/features/prompts/prompt_seed_types.py` (shared `BuiltinPromptSeed` type) to avoid circular imports.

`COMMON_GOLD_FACTS` in `prompt_seed_types.py` is spread with `{**COMMON_GOLD_FACTS, ...}` — do not append to inner lists directly (mutable module-level dict).

## Key file locations

| What | Where |
|---|---|
| FastAPI app + lifespan | `backend/app/main.py` |
| Run orchestration | `backend/app/features/runs/service.py` |
| pass@k computation | `backend/app/features/runs/service.py` — `compute_pass_at_k` |
| Code executor | `backend/app/features/execution/code_executor.py` |
| Execution service (k=5 rows) | `backend/app/features/execution/service.py` — `_ensure_candidate_response_rows` |
| Run schemas | `backend/app/features/runs/schemas.py` |
| Alembic migrations | `backend/alembic/versions/` |
| Frontend run page | `frontend/src/features/runs/runs-page.tsx` |
| Frontend types | `frontend/src/features/runs/types.ts` |
| Docker proxy config | `docker-compose.yml` — `docker-proxy` service |

## Known deferred items

See `_bmad-output/implementation-artifacts/deferred-work.md` for the full list. Notable open items:

- **`candidate_response_count` in `RunRead` is inflated** — counts all 5 samples per code_gen prompt; rename to `candidate_response_sample_count` or add a separate field when the frontend needs an accurate progress count
- **`list_runs` / `get_run_status` load 5× more rows at k=5** — `selectinload(candidate_responses)` fetches all samples; make `list_runs` use a COUNT subquery and `get_run_status` use a lightweight query
- **Report service renders all 5 sample rows** — `reports/service.py` iterates all candidate_responses without filtering by `sample_index`; fix when report generation supports code_gen natively
- **`_wait_or_kill` timer/event race** — benign but theoretically unsound; replace with a lock-guarded flag if needed
- **`rubric()` weight computation** — integer floor division leaves remainder for most key counts (e.g. 3 keys → total 99); fix when judge scoring is formalized
- **Naming inconsistency** — `PromptRead` uses `test_cases_visible` (clean); `RunPromptSnapshotRead` uses `test_cases_visible_jsonb` (with suffix); align when runs API is next touched
