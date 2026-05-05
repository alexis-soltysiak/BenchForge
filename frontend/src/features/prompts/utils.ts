import type { Prompt, PromptFilterState, PromptFormState, PromptPayload } from "./types";
import {
  DEFAULT_FILTER_STATE,
  PROMPT_FILTERS_STORAGE_KEY,
  emptyForm,
} from "./constants";

export function formatJson(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  return JSON.stringify(value, null, 2);
}

export function parseJsonField<T>(value: string, fallback: T): T {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return JSON.parse(trimmed) as T;
}

export function isJsonValid(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function renderArtifactsPreview(artifacts: Record<string, unknown>[]): string {
  return artifacts
    .map((artifact) => {
      const name = String(artifact.name || "artifact");
      const kind = String(artifact.kind || "document");
      const language = typeof artifact.language === "string" ? artifact.language : "";
      const content = String(artifact.content || "");
      const languageLabel = language ? `, ${language}` : "";
      return `### ${name} (${kind}${languageLabel})\n\`\`\`${language}\n${content}\n\`\`\``;
    })
    .join("\n\n");
}

export function renderJsonishPreview(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value.map((item) => `- ${String(item)}`).join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.every(([, item]) => typeof item === "string")) {
      return entries.map(([key, item]) => `- ${key}: ${String(item)}`).join("\n");
    }
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function renderScenarioPromptPreview(state: PromptFormState): string {
  const sections: { content: string; title: string }[] = [];
  if (state.objective.trim()) {
    sections.push({ title: "Objective", content: state.objective.trim() });
  }
  if (state.context.trim()) {
    sections.push({ title: "Context", content: state.context.trim() });
  }
  if (isJsonValid(state.inputArtifactsJson)) {
    const artifacts = parseJsonField<Record<string, unknown>[]>(state.inputArtifactsJson, []);
    if (Array.isArray(artifacts) && artifacts.length > 0) {
      sections.push({ title: "Artifacts", content: renderArtifactsPreview(artifacts) });
    }
  }
  if (isJsonValid(state.constraintsJson)) {
    const constraints = parseJsonField<unknown>(state.constraintsJson, null);
    const renderedConstraints = renderJsonishPreview(constraints);
    if (renderedConstraints) {
      sections.push({ title: "Constraints", content: renderedConstraints });
    }
  }
  if (state.expectedOutputFormat.trim()) {
    sections.push({
      title: "Expected output format",
      content: state.expectedOutputFormat.trim(),
    });
  }
  if (state.userPromptText.trim()) {
    sections.push({ title: "Task", content: state.userPromptText.trim() });
  }

  if (sections.length === 1 && sections[0].title === "Task") {
    return sections[0].content;
  }
  return sections.map((section) => `## ${section.title}\n${section.content}`).join("\n\n");
}

export function toFormState(prompt: Prompt): PromptFormState {
  return {
    name: prompt.name,
    description: prompt.description ?? "",
    categoryId: String(prompt.category.id),
    tags: prompt.tags.join(", "),
    difficulty: prompt.difficulty,
    systemPromptText: prompt.system_prompt_text ?? "",
    userPromptText: prompt.user_prompt_text,
    evaluationNotes: prompt.evaluation_notes ?? "",
    scenarioType: prompt.scenario_type ?? "",
    objective: prompt.objective ?? "",
    context: prompt.context ?? "",
    inputArtifactsJson: formatJson(prompt.input_artifacts_jsonb, "[]"),
    constraintsJson: formatJson(prompt.constraints_jsonb, "[]"),
    expectedBehaviorJson: formatJson(prompt.expected_behavior_jsonb, "{}"),
    goldFactsJson: formatJson(prompt.gold_facts_jsonb, emptyForm.goldFactsJson),
    judgeRubricJson: formatJson(prompt.judge_rubric_jsonb, emptyForm.judgeRubricJson),
    estimatedInputTokens: prompt.estimated_input_tokens?.toString() ?? "",
    expectedOutputFormat: prompt.expected_output_format ?? "",
    costTier: prompt.cost_tier ?? "low",
    weight: prompt.weight?.toString() ?? "1",
    version: prompt.version ?? "1.0",
    isActive: prompt.is_active,
  };
}

export function toPayload(state: PromptFormState): PromptPayload {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    category_id: Number(state.categoryId),
    system_prompt_text: state.systemPromptText.trim() || null,
    user_prompt_text: state.userPromptText.trim(),
    evaluation_notes: state.evaluationNotes.trim() || null,
    scenario_type: state.scenarioType.trim() || null,
    benchmark_type: state.scenarioType.trim() || null,
    objective: state.objective.trim() || null,
    context: state.context.trim() || null,
    input_artifacts_jsonb: parseJsonField<Record<string, unknown>[]>(state.inputArtifactsJson, []),
    constraints_jsonb: parseJsonField<Record<string, unknown> | unknown[] | null>(state.constraintsJson, null),
    expected_behavior_jsonb: parseJsonField<Record<string, unknown> | unknown[] | null>(state.expectedBehaviorJson, null),
    gold_facts_jsonb: parseJsonField<Record<string, unknown> | null>(state.goldFactsJson, null),
    judge_rubric_jsonb: parseJsonField<Record<string, unknown> | null>(state.judgeRubricJson, null),
    estimated_input_tokens: state.estimatedInputTokens.trim() ? Number(state.estimatedInputTokens) : null,
    expected_output_format: state.expectedOutputFormat.trim() || null,
    cost_tier: state.costTier.trim() || null,
    weight: state.weight.trim() ? Number(state.weight) : null,
    version: state.version.trim() || null,
    tags: state.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    difficulty: state.difficulty,
    is_active: state.isActive,
  };
}

export function formatDateShort(value: string): string {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
}

export function formatDateFull(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export function matchesSearch(prompt: Prompt, search: string): boolean {
  if (!search) return true;
  const haystack = [
    prompt.name,
    prompt.description ?? "",
    prompt.category.name,
    prompt.scenario_type ?? "",
    prompt.objective ?? "",
    prompt.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export function artifactCount(prompt: Prompt): number {
  return Array.isArray(prompt.input_artifacts_jsonb) ? prompt.input_artifacts_jsonb.length : 0;
}

export function matchesArchiveState(prompt: Prompt, showArchived: boolean): boolean {
  return showArchived ? prompt.is_archived : !prompt.is_archived;
}

export function matchesCategory(prompt: Prompt, categoryId: string): boolean {
  return categoryId === "all" || String(prompt.category.id) === categoryId;
}

export function matchesTags(prompt: Prompt, tags: string[]): boolean {
  if (tags.length === 0) return true;
  const promptTags = new Set(prompt.tags.map((tag) => tag.trim().toLowerCase()));
  return tags.every((tag) => promptTags.has(tag.toLowerCase()));
}

export function matchesDifficulty(prompt: Prompt, difficulties: number[]): boolean {
  if (difficulties.length === 0) return true;
  return prompt.difficulty !== null && difficulties.includes(prompt.difficulty);
}

export function uniqueTags(prompts: Prompt[]): string[] {
  return Array.from(
    new Set(prompts.flatMap((p) => p.tags.map((t) => t.trim()).filter(Boolean))),
  ).sort((a, b) => a.localeCompare(b));
}

export function getCategoryLabel(
  categories: Prompt["category"][],
  selectedCategoryId: string,
  allCategoriesLabel: string,
): string {
  if (selectedCategoryId === "all") return allCategoriesLabel;
  return (
    categories.find((c) => String(c.id) === selectedCategoryId)?.name ?? allCategoriesLabel
  );
}

export function readPromptFilterState(): PromptFilterState {
  if (typeof window === "undefined") return DEFAULT_FILTER_STATE;
  const raw = window.localStorage.getItem(PROMPT_FILTERS_STORAGE_KEY);
  if (!raw) return DEFAULT_FILTER_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<PromptFilterState>;
    return {
      showArchived: Boolean(parsed.showArchived),
      search: typeof parsed.search === "string" ? parsed.search : "",
      selectedCategoryId:
        typeof parsed.selectedCategoryId === "string" ? parsed.selectedCategoryId : "all",
      selectedTags: Array.isArray(parsed.selectedTags)
        ? parsed.selectedTags.filter((t): t is string => typeof t === "string")
        : [],
      selectedDifficulties: Array.isArray(parsed.selectedDifficulties)
        ? parsed.selectedDifficulties.filter((d): d is number => typeof d === "number")
        : [],
    };
  } catch {
    return DEFAULT_FILTER_STATE;
  }
}
