# PostgreSQL Data Model

## 1. High-level entities

- prompt_category
- prompt
- prompt_tag
- prompt_tag_link
- model_profile
- benchmark_session
- benchmark_session_prompt
- benchmark_session_candidate
- benchmark_session_judge
- session_run
- session_run_prompt_snapshot
- session_run_model_snapshot
- candidate_response
- response_metric
- judge_batch
- judge_evaluation
- judge_evaluation_candidate
- model_global_summary
- report_artifact

## 2. Entity details

### prompt_category

Stores built-in and later custom categories.

Fields:
- id
- name
- slug
- description
- is_system
- created_at

### prompt

Global prompt library entry.

Fields:
- id
- name
- slug
- description
- category_id
- system_prompt_text nullable
- user_prompt_text
- evaluation_notes nullable
- is_active
- is_archived
- created_at
- updated_at

### prompt_tag

Fields:
- id
- name
- slug
- created_at

### prompt_tag_link

Fields:
- prompt_id
- tag_id

### model_profile

Shared registry for candidate and judge models.

Fields:
- id
- display_name
- slug
- role (`candidate`, `judge`, `both`)
- provider_type
- api_style
- runtime_type (`remote`, `local`)
- machine_label nullable
- endpoint_url
- model_identifier
- secret_encrypted nullable
- timeout_seconds
- context_window nullable
- pricing_input_per_million nullable
- pricing_output_per_million nullable
- notes nullable
- local_load_instructions nullable
- is_active
- is_archived
- created_at
- updated_at

### benchmark_session

Editable benchmark configuration.

Fields:
- id
- name
- description nullable
- status (`draft`, `ready`, `archived`)
- max_candidates default 5
- rubric_version
- created_at
- updated_at

### benchmark_session_prompt

Fields:
- id
- session_id
- prompt_id
- display_order

### benchmark_session_candidate

Fields:
- id
- session_id
- model_profile_id
- display_order

### benchmark_session_judge

Fields:
- id
- session_id
- model_profile_id
- display_order

### session_run

Immutable execution record.

Fields:
- id
- session_id
- name
- status (`pending`, `running_candidates`, `waiting_local`, `judging`, `aggregating`, `reporting`, `completed`, `failed`, `cancelled`)
- launched_at
- completed_at nullable
- rubric_version
- report_status
- html_report_path nullable
- pdf_report_path nullable
- notes nullable

### session_run_prompt_snapshot

Fields:
- id
- run_id
- source_prompt_id
- source_prompt_updated_at nullable
- name
- category_name
- system_prompt_text nullable
- user_prompt_text
- evaluation_notes nullable
- snapshot_order

### session_run_model_snapshot

Fields:
- id
- run_id
- source_model_profile_id
- role
- display_name
- provider_type
- api_style
- runtime_type
- machine_label nullable
- endpoint_url
- model_identifier
- timeout_seconds
- context_window nullable
- pricing_input_per_million nullable
- pricing_output_per_million nullable
- local_load_instructions nullable

### candidate_response

One response per candidate model per prompt snapshot.

Fields:
- id
- run_id
- prompt_snapshot_id
- model_snapshot_id
- status (`pending`, `running`, `completed`, `failed`, `skipped`)
- request_payload_jsonb
- raw_response_text nullable
- normalized_response_text nullable
- raw_response_jsonb nullable
- started_at nullable
- completed_at nullable
- retry_count default 0
- error_message nullable

### response_metric

Technical metrics for a candidate response.

Fields:
- id
- candidate_response_id
- duration_ms nullable
- local_wait_ms nullable
- input_tokens nullable
- output_tokens nullable
- total_tokens nullable
- tokens_per_second nullable
- estimated_cost nullable
- extra_metrics_jsonb nullable

### judge_batch

Represents a judging batch, especially useful when the number of candidates later exceeds one batch size.

Fields:
- id
- run_id
- prompt_snapshot_id
- judge_model_snapshot_id
- batch_index
- randomized_candidate_ids_jsonb
- request_payload_jsonb
- raw_response_text nullable
- raw_response_jsonb nullable
- status
- started_at nullable
- completed_at nullable
- error_message nullable

### judge_evaluation

One judge output for one batch.

Fields:
- id
- judge_batch_id
- parsed_output_jsonb
- schema_version
- created_at

### judge_evaluation_candidate

Normalized per-candidate scoring from judge output.

Fields:
- id
- judge_evaluation_id
- candidate_response_id
- anonymized_candidate_label
- overall_score numeric(5,2)
- relevance_score numeric(5,2)
- accuracy_score numeric(5,2)
- completeness_score numeric(5,2)
- clarity_score numeric(5,2)
- instruction_following_score numeric(5,2)
- ranking_in_batch integer
- strengths_text nullable
- weaknesses_text nullable
- short_feedback nullable
- detailed_feedback nullable
- judge_confidence_score numeric(5,2) nullable

### model_global_summary

Stores session-level synthesis for one candidate model.

Fields:
- id
- run_id
- model_snapshot_id
- average_overall_score numeric(5,2)
- average_relevance_score numeric(5,2)
- average_accuracy_score numeric(5,2)
- average_completeness_score numeric(5,2)
- average_clarity_score numeric(5,2)
- average_instruction_following_score numeric(5,2)
- avg_duration_ms nullable
- avg_total_tokens nullable
- avg_tokens_per_second nullable
- total_estimated_cost nullable
- global_summary_text nullable
- best_patterns_text nullable
- weak_patterns_text nullable
- final_global_score numeric(5,2) nullable

### report_artifact

Fields:
- id
- run_id
- artifact_type (`html`, `pdf`, `json_export`)
- file_path
- created_at

## 3. Notes on future-proofing

The schema should remain compatible with:

- multiple judges per run
- prompt variables and prompt datasets
- benchmark packs
- comparison views across runs
- queue-backed execution
- richer metrics and advanced scoring models
