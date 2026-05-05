import type { PromptFilterState, PromptFormState } from "./types";

export const DIFFICULTY_COLORS: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-lime-500",
  3: "bg-amber-500",
  4: "bg-orange-500",
  5: "bg-red-500",
};

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Très facile",
  2: "Facile",
  3: "Moyen",
  4: "Difficile",
  5: "Très difficile",
};

export const DIFFICULTY_STYLES: Record<number, string> = {
  1: "bg-emerald-500 text-white",
  2: "bg-cyan-500 text-white",
  3: "bg-amber-500 text-white",
  4: "bg-orange-500 text-white",
  5: "bg-red-500 text-white",
};

export const PROMPT_FILTERS_STORAGE_KEY = "benchforge.prompt-library.filters";

export const DEFAULT_FILTER_STATE: PromptFilterState = {
  showArchived: false,
  search: "",
  selectedCategoryId: "all",
  selectedTags: [],
  selectedDifficulties: [],
};

export const emptyForm: PromptFormState = {
  name: "",
  description: "",
  categoryId: "",
  tags: "",
  difficulty: null,
  systemPromptText: "",
  userPromptText: "",
  evaluationNotes: "",
  scenarioType: "",
  objective: "",
  context: "",
  inputArtifactsJson: "[]",
  constraintsJson: "[]",
  expectedBehaviorJson: "{}",
  goldFactsJson: "{\n  \"must_include\": [],\n  \"must_not_include\": [],\n  \"acceptable_solutions\": [],\n  \"common_failure_modes\": []\n}",
  judgeRubricJson: "{\n  \"criteria\": [],\n  \"penalties\": []\n}",
  estimatedInputTokens: "",
  expectedOutputFormat: "",
  costTier: "low",
  weight: "1",
  version: "1.0",
  isActive: true,
};
