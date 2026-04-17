# API Design

## Base principles

- REST-first for MVP
- clear feature boundaries
- async execution endpoints
- artifact download endpoints

## Prompt library

- `GET /api/prompts`
- `POST /api/prompts`
- `GET /api/prompts/{prompt_id}`
- `PATCH /api/prompts/{prompt_id}`
- `POST /api/prompts/{prompt_id}/archive`
- `GET /api/prompt-categories`

## Model registry

- `GET /api/model-profiles`
- `POST /api/model-profiles`
- `GET /api/model-profiles/{model_id}`
- `PATCH /api/model-profiles/{model_id}`
- `POST /api/model-profiles/{model_id}/archive`
- `POST /api/model-profiles/{model_id}/test-connection`

## Sessions

- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/{session_id}`
- `PATCH /api/sessions/{session_id}`
- `POST /api/sessions/{session_id}/archive`
- `POST /api/sessions/{session_id}/prompts`
- `DELETE /api/sessions/{session_id}/prompts/{session_prompt_id}`
- `POST /api/sessions/{session_id}/candidates`
- `DELETE /api/sessions/{session_id}/candidates/{session_candidate_id}`
- `POST /api/sessions/{session_id}/judges`
- `DELETE /api/sessions/{session_id}/judges/{session_judge_id}`
- `POST /api/sessions/{session_id}/duplicate`

## Runs

- `POST /api/sessions/{session_id}/launch`
- `GET /api/runs`
- `GET /api/runs/{run_id}`
- `GET /api/runs/{run_id}/status`
- `POST /api/runs/{run_id}/resume`
- `POST /api/runs/{run_id}/cancel`
- `POST /api/runs/{run_id}/retry-failed`

## Local execution

- `GET /api/runs/{run_id}/local-next`
- `POST /api/runs/{run_id}/local-confirm-ready`
- `POST /api/runs/{run_id}/local-start-current`

## Candidate responses

- `GET /api/runs/{run_id}/responses`
- `GET /api/runs/{run_id}/responses/{response_id}`

## Judging

- `GET /api/runs/{run_id}/judging`
- `POST /api/runs/{run_id}/judging/retry`

## Reports

- `GET /api/runs/{run_id}/report`
- `POST /api/runs/{run_id}/report/generate`
- `GET /api/runs/{run_id}/report/html`
- `GET /api/runs/{run_id}/report/pdf`

## Future endpoints

- `GET /api/compare/runs`
- `POST /api/prompts/suggest-category`
- `GET /api/benchmark-packs`
- `POST /api/benchmark-packs`
