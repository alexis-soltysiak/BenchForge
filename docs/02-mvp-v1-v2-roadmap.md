# MVP / V1 / V2 Roadmap

## MVP

### Scope

- PostgreSQL-backed local/self-hosted app
- FastAPI backend, React + ShadCN frontend
- Prompt library
- Candidate/judge model registry
- Benchmark sessions
- Run snapshots
- Remote auto execution
- Local guided execution for one local model at a time
- One judge per session
- Maximum 5 candidate models per session
- Fixed rubric
- HTML report + PDF export
- Built-in starter prompts

### User value

Allows users to run a high-quality, reproducible benchmark locally without needing SaaS infrastructure.

## V1

### Scope additions

- Prompt variables
- Prompt category and tag suggestion on creation
- Two judges per session
- Run-to-run/session comparison views
- Category-specific rubrics
- More detailed report analytics
- Better import/duplication workflows
- Benchmark packs / prompt sets

### User value

Turns the product from a strong local benchmark runner into a more complete benchmark analysis platform.

## V2

### Scope additions

- Parallel sessions/runs
- Queue backend with Redis/Celery or equivalent
- More provider adapters
- Pairwise / tournament / Elo-like judging strategies
- Benchmark suites for multimodal and advanced tasks
- Plugin-style adapter system
- Public result publishing options

### User value

Expands performance, flexibility, and ecosystem adoption.
