export type PromptCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
};

export type Prompt = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: PromptCategory;
  system_prompt_text: string | null;
  user_prompt_text: string;
  evaluation_notes: string | null;
  scenario_type: string | null;
  benchmark_type: string | null;
  objective: string | null;
  context: string | null;
  input_artifacts_jsonb: Record<string, unknown>[] | null;
  constraints_jsonb: Record<string, unknown> | unknown[] | null;
  expected_behavior_jsonb: Record<string, unknown> | unknown[] | null;
  gold_facts_jsonb: Record<string, unknown> | null;
  judge_rubric_jsonb: Record<string, unknown> | null;
  estimated_input_tokens: number | null;
  expected_output_format: string | null;
  cost_tier: string | null;
  weight: number | null;
  version: string | null;
  tags: string[];
  difficulty: number | null;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type PromptListResponse = {
  items: Prompt[];
  total: number;
};

export type PromptFormState = {
  name: string;
  description: string;
  categoryId: string;
  tags: string;
  difficulty: number | null;
  systemPromptText: string;
  userPromptText: string;
  evaluationNotes: string;
  scenarioType: string;
  objective: string;
  context: string;
  inputArtifactsJson: string;
  constraintsJson: string;
  expectedBehaviorJson: string;
  goldFactsJson: string;
  judgeRubricJson: string;
  estimatedInputTokens: string;
  expectedOutputFormat: string;
  costTier: string;
  weight: string;
  version: string;
  isActive: boolean;
};

export type PromptFilterState = {
  showArchived: boolean;
  search: string;
  selectedCategoryId: string;
  selectedTags: string[];
  selectedDifficulties: number[];
};

export type PromptPayload = {
  name: string;
  description: string | null;
  category_id: number;
  system_prompt_text: string | null;
  user_prompt_text: string;
  evaluation_notes: string | null;
  scenario_type: string | null;
  benchmark_type?: string | null;
  objective: string | null;
  context: string | null;
  input_artifacts_jsonb: Record<string, unknown>[] | null;
  constraints_jsonb: Record<string, unknown> | unknown[] | null;
  expected_behavior_jsonb: Record<string, unknown> | unknown[] | null;
  gold_facts_jsonb: Record<string, unknown> | null;
  judge_rubric_jsonb: Record<string, unknown> | null;
  estimated_input_tokens: number | null;
  expected_output_format: string | null;
  cost_tier: string | null;
  weight: number | null;
  version: string | null;
  tags: string[];
  difficulty: number | null;
  is_active: boolean;
};
