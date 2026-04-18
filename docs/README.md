# LLM Benchmark Studio — Documentation

This `docs/` folder contains the product, technical, and delivery documentation for the open-source benchmark platform.

## Documents

- `01-product-spec.md` — Product vision, scope, glossary, and functional requirements
- `02-mvp-v1-v2-roadmap.md` — Delivery roadmap by version
- `03-architecture.md` — Backend/frontend architecture and major technical decisions
- `04-data-model.md` — PostgreSQL data model and entity relationships
- `05-api-design.md` — Suggested API surface for MVP and beyond
- `06-ux-ui.md` — UX flows and page-by-page UI specification
- `07-judge-scoring.md` — Judge strategy, structured outputs, scoring, and aggregation
- `08-reporting.md` — HTML/PDF report structure and analytics requirements
- `09-seed-prompts.md` — Default built-in benchmark prompts for the first release
- `10-pr-roadmap.md` — Ordered pull request plan for MVP, V1, and V2
- `11-open-source-guidelines.md` — Repo conventions, contribution guidelines, and operational notes

## Product summary

LLM Benchmark Studio is an open-source, self-hostable benchmark tool for evaluating local and remote language models using reusable prompt libraries, benchmark sessions, structured LLM-as-a-judge evaluation, and polished HTML/PDF reports.

For the MVP, the app also ships with a default built-in benchmark prompt library described in `09-seed-prompts.md`.

## Core principles

- Open-source first
- Local/self-hosted execution
- PostgreSQL as the primary database
- FastAPI backend with feature-based architecture
- React + ShadCN frontend
- High-quality reports with reproducible runs
- Remote and local model execution in the same workflow
