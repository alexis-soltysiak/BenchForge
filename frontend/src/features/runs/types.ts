export type RunPromptSnapshot = {
  id: number;
  source_prompt_id: number;
  source_prompt_updated_at: string | null;
  name: string;
  category_name: string;
  system_prompt_text: string | null;
  user_prompt_text: string;
  evaluation_notes: string | null;
  snapshot_order: number;
};

export type RunModelSnapshot = {
  id: number;
  source_model_profile_id: number;
  role: string;
  display_name: string;
  provider_type: string;
  api_style: string;
  runtime_type: string;
  machine_label: string | null;
  endpoint_url: string;
  model_identifier: string;
  timeout_seconds: number;
  context_window: number | null;
  pricing_input_per_million: string | null;
  pricing_output_per_million: string | null;
  local_load_instructions: string | null;
};

export type Run = {
  id: number;
  session_id: number;
  name: string;
  status: string;
  launched_at: string;
  completed_at: string | null;
  rubric_version: string;
  report_status: string;
  html_report_path: string | null;
  pdf_report_path: string | null;
  notes: string | null;
  prompt_snapshots: RunPromptSnapshot[];
  model_snapshots: RunModelSnapshot[];
  global_summaries: RunGlobalSummary[];
  candidate_response_count: number;
};

export type RunListItem = {
  id: number;
  session_id: number;
  name: string;
  status: string;
  launched_at: string;
  rubric_version: string;
  report_status: string;
  prompt_count: number;
  model_count: number;
};

export type RunListResponse = {
  items: RunListItem[];
  total: number;
};

export type CandidateResponseMetric = {
  duration_ms: number | null;
  local_wait_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  tokens_per_second: string | null;
  estimated_cost: string | null;
  extra_metrics_jsonb: string | null;
};

export type CandidateResponse = {
  id: number;
  run_id: number;
  prompt_snapshot_id: number;
  model_snapshot_id: number;
  status: string;
  request_payload_jsonb: string | null;
  raw_response_text: string | null;
  normalized_response_text: string | null;
  raw_response_jsonb: string | null;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  error_message: string | null;
  metric: CandidateResponseMetric | null;
};

export type CandidateResponseListResponse = {
  items: CandidateResponse[];
  total: number;
};

export type LocalExecutionPromptItem = {
  prompt_snapshot_id: number;
  prompt_name: string;
  response_status: string;
};

export type LocalExecutionNextResponse = {
  run_id: number;
  model_snapshot_id: number;
  display_name: string;
  provider_type: string;
  runtime_type: string;
  machine_label: string | null;
  endpoint_url: string;
  model_identifier: string;
  local_load_instructions: string | null;
  pending_prompt_count: number;
  confirmed_ready: boolean;
  prompts: LocalExecutionPromptItem[];
};

export type RunGlobalSummary = {
  id: number;
  model_snapshot_id: number;
  average_overall_score: string;
  average_relevance_score: string;
  average_accuracy_score: string;
  average_completeness_score: string;
  average_clarity_score: string;
  average_instruction_following_score: string;
  avg_duration_ms: number | null;
  avg_total_tokens: number | null;
  avg_tokens_per_second: string | null;
  total_estimated_cost: string | null;
  global_summary_text: string | null;
  best_patterns_text: string | null;
  weak_patterns_text: string | null;
  final_global_score: string | null;
};

export type JudgeEvaluationCandidate = {
  id: number;
  candidate_response_id: number;
  anonymized_candidate_label: string;
  overall_score: string;
  relevance_score: string;
  accuracy_score: string;
  completeness_score: string;
  clarity_score: string;
  instruction_following_score: string;
  ranking_in_batch: number;
  strengths_text: string | null;
  weaknesses_text: string | null;
  short_feedback: string | null;
  detailed_feedback: string | null;
  judge_confidence_score: string | null;
};

export type JudgeEvaluation = {
  id: number;
  judge_batch_id: number;
  parsed_output_jsonb: string;
  schema_version: string;
  created_at: string;
  candidates: JudgeEvaluationCandidate[];
};

export type JudgeBatch = {
  id: number;
  run_id: number;
  prompt_snapshot_id: number;
  judge_model_snapshot_id: number;
  batch_index: number;
  randomized_candidate_ids_jsonb: string;
  request_payload_jsonb: string | null;
  raw_response_text: string | null;
  raw_response_jsonb: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  evaluation: JudgeEvaluation | null;
};

export type RunJudging = {
  run_id: number;
  run_status: string;
  total_batches: number;
  completed_batches: number;
  failed_batches: number;
  running_batches: number;
  pending_batches: number;
  items: JudgeBatch[];
};
