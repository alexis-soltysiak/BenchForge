# Product Specification

## 1. Purpose

LLM Benchmark Studio is an open-source benchmark platform that lets users compare multiple candidate models on shared prompt sets, evaluate responses with one or more judge models, and generate a high-quality local report in HTML and PDF.

The product is designed for users who want to run the tool locally on their own machine or self-host it, while keeping support for both remote APIs and local runtimes such as LM Studio.

## 2. Product goals

### Primary goals

- Compare models on response quality
- Measure latency, token usage, throughput, and cost
- Produce a global score with quality as the dominant signal
- Generate polished, shareable local reports
- Preserve reproducibility through immutable run snapshots

### Secondary goals

- Make benchmark setup simple through reusable libraries
- Support hybrid execution: remote providers + local runtimes
- Provide structured judge outputs rather than loose prose only
- Lay foundations for future comparison across runs and versions

## 3. Non-goals for MVP

- Multi-user collaboration
- Cloud multi-tenant SaaS
- Human manual scoring workflows
- Unlimited candidate counts in one judge pass
- Pairwise tournament ranking
- Agent/tool-calling benchmark coverage
- Multimodal workflows

## 4. Product positioning

An open-source local-first benchmark studio for LLM builders, researchers, and technical teams.

## 5. User archetypes

### Solo builder

Runs benchmark sessions locally to compare models before integrating them into products.

### Applied AI engineer

Uses a repeatable prompt library and benchmark sessions to compare provider, prompt, and configuration choices.

### Open-source contributor

Improves adapters, judges, reports, and benchmark packs.

## 6. Core domain concepts

### Prompt library

A global library of reusable prompts. Prompts are defined once, categorized, tagged, and then selected into sessions.

### Model registry

A global registry of inference targets. A “model” in the product is effectively a model profile, including provider, endpoint, auth, runtime type, and default inference settings.

### Judge registry

Judge models are stored in the same registry as candidate models, with a role marker such as `judge` or `both`.

### Benchmark session

A user-defined benchmark configuration that selects prompts, candidate models, and judge model(s).

### Session run

A concrete immutable execution of a benchmark session. It snapshots the selected prompts, models, and settings at launch time.

## 7. Product constraints

- Self-hosted/local execution
- PostgreSQL required
- Report generation must work locally
- Local models may require manual operator intervention
- Judge anonymization is required
- MVP supports at most 5 candidate models per session
- MVP supports 1 judge per session

## 8. Functional requirements

### Prompt library

The system must allow users to:

- Create a global prompt
- Store prompt name, description, category, content, and tags
- Archive prompts without hard deletion
- Select prompts from the global library when configuring a session
- Duplicate prompts in later versions
- Preserve immutable prompt snapshots in runs

### Categories

The system must provide built-in categories for MVP:

- General QA
- Summarization
- Structured Output
- Classification
- Writing
- Translation
- Reasoning
- Coding

In V1, prompt validation may call an LLM to suggest category and tags.

### Model registry

The system must allow users to:

- Register remote and local model profiles
- Store display name, provider, endpoint, auth, runtime type, and notes
- Mark a model as candidate, judge, or both
- Archive model profiles without hard deletion
- Encrypt secrets at rest in PostgreSQL

### Benchmark sessions

The system must allow users to:

- Create a benchmark session
- Select prompts from the prompt library
- Select up to 5 candidate models for MVP
- Select one judge model for MVP
- Launch a run from the session
- View run progress and statuses

### Run orchestration

The system must support:

- Automatic execution for remote candidate models
- Guided manual execution for local models, one at a time
- Retry handling for failed remote calls
- Partial reruns of failed or missing steps
- Run status transitions for each phase

### Evaluation

The judge workflow must:

- Randomize candidate order before judging
- Anonymize model identities for the judge
- Evaluate per prompt
- Return structured output
- Score candidates on 0–100 scales
- Rank candidates within the lot
- Produce per-prompt feedback and global synthesis

### Reports

The system must generate:

- A polished HTML report
- A PDF export based on the HTML report
- A summary matrix by model and judge
- Detailed pages by model and by prompt
- Technical metrics and global synthesis

## 9. Quality attributes

- Reproducibility
- Traceability
- Extensibility
- Clear separation between configuration and execution
- Open-source contributor friendliness

## 10. Versioning principles

All benchmark runs must be reproducible. The platform must snapshot:

- Prompt content
- Prompt metadata
- Candidate model profile metadata
- Judge profile metadata
- Execution settings
- Judge rubric version

## 11. Success criteria

### MVP success criteria

- User can create a prompt library
- User can register candidate and judge models
- User can create a session and launch a run
- User can execute remote and guided local candidates
- User receives structured judged results
- User can export HTML/PDF report

### V1 success criteria

- Prompt variables
- Session-to-session comparison
- Two judges
- Category-aware rubrics
- Better provider coverage

### V2 success criteria

- Parallel runs
- More provider adapters
- Benchmark packs
- Richer evaluation strategies
- Advanced analytics and dashboards
