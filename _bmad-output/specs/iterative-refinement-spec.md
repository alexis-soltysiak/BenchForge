# Iterative Refinement — Feature Spec

**Status:** Draft  
**Date:** 2026-05-03  
**Context:** Additive to the existing pass@k independent-sampling feature. Both coexist.

---

## Overview

BenchForge currently benchmarks code-generation prompts with **k=5 independent samples**: five fresh API calls with no feedback between them. This measures raw generation ceiling (pass@k).

Iterative refinement adds a second strategy: **the model sees its own previous code and execution error before each retry**. This measures self-correction ability — a distinct and valuable signal.

The user chooses the strategy **per prompt**, not per run. A single run can contain a mix of both modes.

---

## User Experience

### Configuring the mode

In the **Prompt Library editor** (the modal that opens when creating or editing a prompt), a new `sampling_mode` field appears for prompts with `scenario_type = "code_generation"`:

```
Sampling mode
  ○ Independent samples   — k=5 fresh calls, no feedback between attempts (default)
  ○ Iterative refinement  — each attempt sees the previous code + execution error
```

This field is only meaningful for `code_generation` prompts (test-harness execution). For all other scenario types it is irrelevant and hidden.

### Viewing results in a run

The existing **Code Generation Results** section (pass@k table + Browse drill-down) is extended:

- A `Mode` badge appears per prompt in the Browse drill-down rows: `independent` or `iterative`
- For iterative prompts, sample column headers change from `#0 #1 #2 #3 #4` to `A1 A2 A3 A4 A5` (Attempt 1–5)
- A skipped sample (early-stopped because a prior attempt passed) shows a dimmed `—` instead of a pass/fail badge
- The code-view modal title reads `Sample #N` for independent, `Attempt #N` for iterative
- The aggregate pass@k rates in the summary table are computed identically for both modes (pass@1 = first attempt passed, pass@5 = any attempt passed within 5)

---

## Technical Design

### New field: `sampling_mode`

| Location | Column | Type | Default |
|---|---|---|---|
| `prompt` table | `sampling_mode` | `VARCHAR(32) NOT NULL` | `'independent'` |
| `session_run_prompt_snapshot` table | `sampling_mode` | `VARCHAR(32) NOT NULL` | `'independent'` |

Valid values: `independent`, `iterative`

The snapshot captures the mode at run launch time (same pattern as all other snapshotted fields).

### Migration

File: `backend/alembic/versions/20260503_0016_add_sampling_mode.py`

```sql
ALTER TABLE prompt
  ADD COLUMN sampling_mode VARCHAR(32) NOT NULL DEFAULT 'independent';

ALTER TABLE session_run_prompt_snapshot
  ADD COLUMN sampling_mode VARCHAR(32) NOT NULL DEFAULT 'independent';
```

### Execution flow

`_ensure_candidate_response_rows` is unchanged — it always creates k=5 rows for any `code_generation` prompt, regardless of mode.

**Independent mode** — unchanged: all 5 rows for a given (prompt, model) are dispatched in parallel via `asyncio.gather`.

**Iterative mode** — new `_execute_iterative_chain(run, prompt_snapshot, model_snapshot, responses)`:

```
for i in 0..4:
  if previous attempt passed (tier == 2):
    mark remaining samples as completed/skipped, break
  
  build prompt_text:
    if i == 0: use base user_prompt_text as-is
    if i > 0:  append ## Previous Attempt block (see Prompt Injection below)
  
  run single task (sequential, one at a time)
  commit after each sample
```

When `start_remote_candidate` / `start_local_current` processes responses for a model, it splits them by `sampling_mode`:
- `independent` responses → dispatched as a batch via the existing `_execute_prepared_tasks`
- `iterative` responses → grouped by `prompt_snapshot_id`, each group runs via `_execute_iterative_chain`

The two sets run concurrently at the group level (different prompts can run in parallel even in iterative mode), but within a single iterative group the samples are strictly sequential.

### Prompt injection (iterative only, sample_index > 0)

Appended to the base user prompt:

```
---

## Previous Attempt

Your previous code:
```python
{normalized_response_text or "(no code generated)"}
```

Execution feedback:
{feedback}

Please fix the code and return the corrected solution.
```

Where `feedback` is:
- `execution_tier == 1` → `"The code ran but failed one or more test cases."`  
  + if `error_message` present: append `"\nDetails: {error_message}"`
- `execution_tier == 0` + `error_message` → the error_message text
- `execution_tier == 0` + no error → `"The code failed to execute (syntax error, timeout, or runtime error)."`

### Early stopping

When a sample passes (`execution_tier == 2`), remaining pending samples for that chain are marked:

```python
response.status = "completed"
response.execution_tier = None   # not a real run, excluded from pass computation
response.error_message = f"Skipped — attempt {prev_sample_index} passed."
response.started_at = now
response.completed_at = now
```

This allows `_advance_run_after_candidate_execution` to proceed normally (no pending/failed/cancelled blocking it).

pass@k computation is unaffected: `execution_tier=None` defaults to 0, but the earlier passing sample already sets the pass flag.

### `_prepare_execution_task` change

Add `prompt_text_override: str | None = None` parameter. When provided, it replaces `prompt_snapshot.user_prompt_text` as the prompt sent to the model.

---

## Files to Change

### Backend

| File | Change |
|---|---|
| `app/features/prompts/models.py` | Add `sampling_mode` column to `Prompt` |
| `app/features/prompts/schemas.py` | Add `sampling_mode` to `PromptRead`, `PromptCreate`, `PromptUpdate` |
| `app/features/prompts/service.py` | Serialize + persist `sampling_mode` in create/update/seed paths |
| `app/features/prompts/prompt_seed_types.py` | Add `sampling_mode: str = "independent"` to `BuiltinPromptSeed` |
| `app/features/runs/models.py` | Add `sampling_mode` column to `SessionRunPromptSnapshot` |
| `app/features/runs/schemas.py` | Add `sampling_mode` to `RunPromptSnapshotRead` |
| `app/features/runs/service.py` | Copy `sampling_mode` in `serialize_prompt_snapshot` + `_build_prompt_snapshot` |
| `app/features/execution/service.py` | Add `_execute_iterative_chain`, `_inject_prior_attempt`; update `start_remote_candidate` + `start_local_current` to route by mode |
| `alembic/versions/20260503_0016_add_sampling_mode.py` | New migration |

### Frontend

| File | Change |
|---|---|
| `src/features/prompts/types.ts` | Add `sampling_mode: string` to `Prompt`, `PromptPayload` |
| `src/features/prompts/prompt-library-page.tsx` | Add `samplingMode` to form state; show select when `scenarioType === "code_generation"` |
| `src/features/runs/types.ts` | Add `sampling_mode: string` to `RunPromptSnapshot` |
| `src/features/runs/runs-page.tsx` | Mode badge in browse drill-down; column headers for iterative; modal title suffix |

---

## Open Questions

- **k for iterative:** Always 5 like independent? Or configurable per prompt? → **Decision: keep k=5 for now, configurable later.**
- **Retry behaviour:** If a user retries a failed iterative sample via the retry button, should it inject the prior attempt? → **Decision: no special handling for now; retry re-runs the original prompt (safe default).**
- **pass@k label in summary table:** When a run has both modes, show a note "(mixed modes)" next to the rates? → **TBD in implementation.**
