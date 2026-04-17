# Pull Request Roadmap

## MVP Pull Requests

### PR 001 — Repository bootstrap

- Initialize FastAPI backend with uv
- Initialize React + TypeScript + ShadCN frontend
- Add Docker Compose with PostgreSQL
- Add formatting/linting/tooling
- Add base README and contribution docs

### PR 002 — Core backend foundation

- Add config, database, logging, security, encryption modules
- Add SQLAlchemy base and Alembic setup
- Add health endpoint

### PR 003 — Prompt library backend

- Add prompt categories, prompts, tags tables
- Add CRUD endpoints
- Add archive support
- Seed built-in categories

### PR 004 — Prompt library frontend

- Prompt library page
- Prompt table and create/edit form
- Archive flow

### PR 005 — Model registry backend

- Add model profile table
- Add secret encryption support
- Add CRUD endpoints
- Add connection test endpoint

### PR 006 — Model registry frontend

- Model registry page
- Create/edit forms
- Masked secret UX
- runtime/provider badges

### PR 007 — Sessions backend

- Add sessions, session prompts, session candidates, session judges tables
- Add CRUD and duplication endpoints
- Enforce max 5 candidates in MVP

### PR 008 — Sessions frontend

- Sessions list
- Session builder page
- Prompt/model/judge selectors

### PR 009 — Run snapshot backend

- Add run tables and snapshot logic
- Launch endpoint
- Initial run state machine

### PR 010 — Remote execution engine

- Implement remote adapter abstraction
- OpenAI-compatible adapter
- HuggingFace/basic adapter where feasible
- candidate response persistence
- metric capture

### PR 011 — Local guided execution

- Run local-next flow
- confirm-ready flow
- start-current flow
- run state handling for local models

### PR 012 — Run UI

- Run detail page
- progress timeline
- candidate response status tables
- local operator panel

### PR 013 — Judge engine backend

- Add judge batch and evaluation tables
- randomization and anonymization
- fixed rubric structured output parsing
- store raw + parsed judge outputs

### PR 014 — Judge UI

- Display per-prompt judged scores
- batch status and judge feedback views

### PR 015 — Aggregation and summaries

- aggregate candidate scores
- compute global summaries
- compute technical summaries and global score

### PR 016 — HTML report generation

- generate report data view model
- create print-friendly HTML report

### PR 017 — PDF export

- add PDF generation/export path
- expose artifact download endpoints

### PR 018 — Seed content and polish

- seed built-in prompts
- improve score color coding
- polish empty states and docs

## V1 Pull Requests

### PR 101 — Prompt variables
### PR 102 — Prompt category suggestion via LLM
### PR 103 — Prompt packs / benchmark packs
### PR 104 — Two-judge support
### PR 105 — Category-specific rubrics
### PR 106 — Compare runs / sessions UI
### PR 107 — Better analytics in reports
### PR 108 — Extended provider adapters

## V2 Pull Requests

### PR 201 — Queue backend with Redis/Celery or equivalent
### PR 202 — Parallel session execution
### PR 203 — Multi-judge weighted strategies
### PR 204 — Pairwise/tournament judging
### PR 205 — Plugin-style provider adapters
### PR 206 — Advanced benchmark suites including multimodal support
