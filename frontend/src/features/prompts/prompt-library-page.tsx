import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Archive,
  FileText,
  Plus,
  Search,
  RotateCcw,
  Shapes,
  Sparkles,
  Tag,
  X,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  archivePrompt,
  createPrompt,
  fetchPromptCategories,
  fetchPrompts,
  updatePrompt,
} from "@/features/prompts/api";
import type { Prompt, PromptPayload } from "@/features/prompts/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type PromptFormState = {
  name: string;
  description: string;
  categoryId: string;
  tags: string;
  difficulty: number | null;
  systemPromptText: string;
  userPromptText: string;
  evaluationNotes: string;
  isActive: boolean;
};

const emptyForm: PromptFormState = {
  name: "",
  description: "",
  categoryId: "",
  tags: "",
  difficulty: null,
  systemPromptText: "",
  userPromptText: "",
  evaluationNotes: "",
  isActive: true,
};

function toFormState(prompt: Prompt): PromptFormState {
  return {
    name: prompt.name,
    description: prompt.description ?? "",
    categoryId: String(prompt.category.id),
    tags: prompt.tags.join(", "),
    difficulty: prompt.difficulty,
    systemPromptText: prompt.system_prompt_text ?? "",
    userPromptText: prompt.user_prompt_text,
    evaluationNotes: prompt.evaluation_notes ?? "",
    isActive: prompt.is_active,
  };
}

function toPayload(state: PromptFormState): PromptPayload {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    category_id: Number(state.categoryId),
    system_prompt_text: state.systemPromptText.trim() || null,
    user_prompt_text: state.userPromptText.trim(),
    evaluation_notes: state.evaluationNotes.trim() || null,
    tags: state.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    difficulty: state.difficulty,
    is_active: state.isActive,
  };
}

function formatDateShort(value: string): string {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
}

function formatDateFull(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

const DIFFICULTY_COLORS: Record<number, string> = {
  1: "bg-emerald-400",
  2: "bg-lime-400",
  3: "bg-amber-400",
  4: "bg-orange-500",
  5: "bg-red-500",
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Très facile",
  2: "Facile",
  3: "Moyen",
  4: "Difficile",
  5: "Très difficile",
};

function DifficultyDot({ level }: { level: number | null }) {
  if (!level) {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full bg-border/60 text-[10px] font-bold text-muted-foreground"
        title="Difficulté non définie"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
        DIFFICULTY_COLORS[level],
      )}
      title={`Difficulté : ${DIFFICULTY_LABELS[level] ?? level}`}
    >
      {level}
    </span>
  );
}

function matchesSearch(prompt: Prompt, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    prompt.name,
    prompt.description ?? "",
    prompt.category.name,
    prompt.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function matchesArchiveState(prompt: Prompt, showArchived: boolean): boolean {
  return showArchived ? prompt.is_archived : !prompt.is_archived;
}

function matchesCategory(prompt: Prompt, categoryId: string): boolean {
  return categoryId === "all" || String(prompt.category.id) === categoryId;
}

function matchesTags(prompt: Prompt, tags: string[]): boolean {
  if (tags.length === 0) {
    return true;
  }

  const promptTags = new Set(prompt.tags.map((tag) => tag.trim().toLowerCase()));
  return tags.every((tag) => promptTags.has(tag.toLowerCase()));
}

function matchesDifficulty(prompt: Prompt, difficulties: number[]): boolean {
  if (difficulties.length === 0) {
    return true;
  }
  return prompt.difficulty !== null && difficulties.includes(prompt.difficulty);
}

const DIFFICULTY_STYLES: Record<number, string> = {
  1: "bg-emerald-500 text-white",
  2: "bg-cyan-500 text-white",
  3: "bg-amber-500 text-white",
  4: "bg-orange-500 text-white",
  5: "bg-red-500 text-white",
};

function uniqueTags(prompts: Prompt[]): string[] {
  return Array.from(
    new Set(
      prompts.flatMap((prompt) =>
        prompt.tags.map((tag) => tag.trim()).filter(Boolean),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function getCategoryLabel(
  categories: Prompt["category"][],
  selectedCategoryId: string,
  allCategoriesLabel: string,
): string {
  if (selectedCategoryId === "all") {
    return allCategoriesLabel;
  }

  return (
    categories.find((category) => String(category.id) === selectedCategoryId)
      ?.name ?? allCategoriesLabel
  );
}

type PromptFilterState = {
  showArchived: boolean;
  search: string;
  selectedCategoryId: string;
  selectedTags: string[];
  selectedDifficulties: number[];
};

const PROMPT_FILTERS_STORAGE_KEY = "benchforge.prompt-library.filters";

const DEFAULT_FILTER_STATE: PromptFilterState = {
  showArchived: false,
  search: "",
  selectedCategoryId: "all",
  selectedTags: [],
  selectedDifficulties: [],
};

function readPromptFilterState(): PromptFilterState {
  if (typeof window === "undefined") {
    return DEFAULT_FILTER_STATE;
  }

  const raw = window.localStorage.getItem(PROMPT_FILTERS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_FILTER_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PromptFilterState>;
    return {
      showArchived: Boolean(parsed.showArchived),
      search: typeof parsed.search === "string" ? parsed.search : "",
      selectedCategoryId:
        typeof parsed.selectedCategoryId === "string"
          ? parsed.selectedCategoryId
          : "all",
      selectedTags: Array.isArray(parsed.selectedTags)
        ? parsed.selectedTags.filter((tag): tag is string => typeof tag === "string")
        : [],
      selectedDifficulties: Array.isArray(parsed.selectedDifficulties)
        ? parsed.selectedDifficulties.filter((d): d is number => typeof d === "number")
        : [],
    };
  } catch {
    return DEFAULT_FILTER_STATE;
  }
}

export function PromptLibraryPage() {
  const { t } = useTranslation();
  const initialPromptFilters = readPromptFilterState();
  const [showArchived, setShowArchived] = useState(
    initialPromptFilters.showArchived,
  );
  const [search, setSearch] = useState(initialPromptFilters.search);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialPromptFilters.selectedCategoryId,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialPromptFilters.selectedTags,
  );
  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>(
    initialPromptFilters.selectedDifficulties,
  );
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isTagsMenuOpen, setIsTagsMenuOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [formTagInput, setFormTagInput] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formState, setFormState] = useState<PromptFormState>(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tagsTooltip, setTagsTooltip] = useState<{ tags: string[]; x: number; y: number } | null>(null);
  const [, startTransition] = useTransition();

  const isDirtyRef = useRef(false);
  const skipFormResetRef = useRef(false);

  const updateForm = (updater: (prev: PromptFormState) => PromptFormState) => {
    isDirtyRef.current = true;
    setFormState(updater);
  };

  const categoriesQuery = useQuery({
    queryKey: ["prompt-categories"],
    queryFn: fetchPromptCategories,
  });

  const promptsQuery = useQuery({
    queryKey: ["prompts", showArchived],
    queryFn: () => fetchPrompts(showArchived),
  });

  useEffect(() => {
    if (skipFormResetRef.current) {
      skipFormResetRef.current = false;
      isDirtyRef.current = false;
      return;
    }
    isDirtyRef.current = false;

    if (selectedPrompt) {
      setFormState(toFormState(selectedPrompt));
      return;
    }

    if (categoriesQuery.data && categoriesQuery.data.length > 0) {
      setFormState((current) => ({
        ...emptyForm,
        categoryId: current.categoryId || String(categoriesQuery.data[0].id),
      }));
    }
  }, [categoriesQuery.data, selectedPrompt]);

  useEffect(() => {
    if (!isDirtyRef.current) return;
    const isValid =
      formState.name.trim() &&
      formState.userPromptText.trim() &&
      formState.categoryId;
    if (!isValid) return;

    const timer = setTimeout(() => {
      void saveMutation.mutateAsync(toPayload(formState));
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState]);

  useEffect(() => {
    if (selectedPrompt && !matchesArchiveState(selectedPrompt, showArchived)) {
      setSelectedPrompt(null);
    }
  }, [selectedPrompt, showArchived]);

  useEffect(() => {
    window.localStorage.setItem(
      PROMPT_FILTERS_STORAGE_KEY,
      JSON.stringify({
        showArchived,
        search,
        selectedCategoryId,
        selectedTags,
        selectedDifficulties,
      }),
    );
  }, [search, selectedCategoryId, selectedTags, selectedDifficulties, showArchived]);

  const saveMutation = useMutation({
    mutationFn: async (payload: PromptPayload) => {
      if (selectedPrompt) {
        return updatePrompt(selectedPrompt.id, payload);
      }
      return createPrompt(payload);
    },
    onSuccess: async (prompt) => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      if (!selectedPrompt) {
        skipFormResetRef.current = true;
        startTransition(() => setSelectedPrompt(prompt));
      }
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : t("prompts.feedback.errorSave"),
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archivePrompt,
    onSuccess: async (prompt) => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      setFeedback(t("prompts.feedback.archived", { name: prompt.name }));
      startTransition(() => {
        setSelectedPrompt(null);
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : t("prompts.feedback.errorArchive"),
      );
    },
  });

  const scopedPrompts = (promptsQuery.data?.items ?? []).filter((prompt) =>
    matchesArchiveState(prompt, showArchived),
  );
  const promptTags = uniqueTags(scopedPrompts);
  const categoryOptions = categoriesQuery.data ?? [];
  const categoryLabel = getCategoryLabel(categoryOptions, selectedCategoryId, t("prompts.allCategories"));
  const tagOptions = useMemo(
    () => Array.from(new Set([...promptTags, ...selectedTags])).sort(
      (left, right) => left.localeCompare(right),
    ),
    [promptTags, selectedTags],
  );
  const suggestedTags = tagOptions.filter(
    (tag) => !selectedTags.some((item) => item.toLowerCase() === tag.toLowerCase()),
  );
  const visiblePrompts = scopedPrompts.filter(
    (prompt) =>
      matchesSearch(prompt, search) &&
      matchesCategory(prompt, selectedCategoryId) &&
      matchesTags(prompt, selectedTags) &&
      matchesDifficulty(prompt, selectedDifficulties),
  );
  const categoryCount = categoriesQuery.data?.length ?? 0;
  const hasAnyFilters =
    search.trim().length > 0 ||
    selectedCategoryId !== "all" ||
    selectedTags.length > 0 ||
    selectedDifficulties.length > 0;
  const availableDifficulties = Array.from(
    new Set(scopedPrompts.map((p) => p.difficulty).filter((d): d is number => d !== null)),
  ).sort((a, b) => a - b);
  const loadError =
    (categoriesQuery.error instanceof ApiError && categoriesQuery.error.message) ||
    (promptsQuery.error instanceof ApiError && promptsQuery.error.message) ||
    null;
  const retryLoad = () => {
    void Promise.all([categoriesQuery.refetch(), promptsQuery.refetch()]);
  };

  const openCreateModal = () => {
    startTransition(() => {
      setSelectedPrompt(null);
      setFeedback(null);
      setFormState((current) => ({
        ...emptyForm,
        categoryId:
          current.categoryId ||
          (categoriesQuery.data?.[0] ? String(categoriesQuery.data[0].id) : ""),
      }));
    });
    setFormTagInput("");
    setIsEditorOpen(true);
  };

  const openEditModal = (prompt: Prompt) => {
    startTransition(() => {
      setSelectedPrompt(prompt);
      setFeedback(null);
    });
    setFormTagInput("");
    setIsEditorOpen(true);
  };

  const addTag = (tag: string) => {
    const normalized = tag.trim();
    if (!normalized) {
      return;
    }

    setSelectedTags((current) =>
      current.some((item) => item.toLowerCase() === normalized.toLowerCase())
        ? current
        : [...current, normalized],
    );
    setTagDraft("");
    setIsTagsMenuOpen(true);
  };

  const removeTag = (tag: string) => {
    setSelectedTags((current) => current.filter((item) => item !== tag));
  };

  const addFormTag = (tag: string) => {
    const existing = formState.tags.split(",").map((item) => item.trim()).filter(Boolean);
    if (!existing.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      updateForm((current) => ({ ...current, tags: [...existing, tag].join(", ") }));
    }
  };

  const removeFormTag = (tag: string) => {
    const next = formState.tags
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== tag);
    updateForm((current) => ({ ...current, tags: next.join(", ") }));
  };

  const formTagList = formState.tags.split(",").map((item) => item.trim()).filter(Boolean);
  const formTagSuggestions = promptTags.filter(
    (tag) => !formTagList.some((item) => item.toLowerCase() === tag.toLowerCase()),
  );
  const formTagFiltered = formTagSuggestions
    .filter((tag) =>
      !formTagInput.trim() || tag.toLowerCase().includes(formTagInput.trim().toLowerCase()),
    )
    .slice(0, 3);

  const selectedPromptId = selectedPrompt?.id ?? null;

  return (
    <div className="text-foreground">
      <div className="px-3 py-5 lg:px-6 lg:py-6 xl:px-7">
        <section className="relative overflow-hidden rounded-[1.65rem] border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3.5 shadow-xl lg:p-4">
          <div className="absolute left-0 top-0 h-full w-[58%] bg-[var(--hero-bg)]" />
          <div className="absolute inset-0 bg-[linear-gradient(var(--hero-grid)_1px,transparent_1px),linear-gradient(90deg,var(--hero-grid)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
          <div className="relative flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_31rem] lg:items-center lg:gap-4">
            <div className="relative max-w-[30rem] space-y-2">
              <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-950">
                {t("prompts.reusableAssets")}
              </span>
              <h1 className="font-display text-[1.8rem] font-semibold tracking-tight text-foreground lg:text-[2.2rem]">
                {t("prompts.pageTitle")}
              </h1>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3">
              <MetricCard
                compact
                className="rounded-[1.2rem]"
                label={t("prompts.metricVisible")}
                tone="amber"
                value={String(visiblePrompts.length)}
                icon={FileText}
              />
              <MetricCard
                compact
                className="rounded-[1.2rem]"
                label={t("prompts.metricCategories")}
                tone="amber"
                value={String(categoryCount)}
                icon={Shapes}
              />
              <MetricCard
                compact
                className="rounded-[1.2rem]"
                label={t("prompts.metricSystemPacks")}
                tone="amber"
                value={String(
                  (categoriesQuery.data ?? []).filter((item) => item.is_system).length,
                )}
                icon={Sparkles}
              />
            </div>
          </div>
        </section>

        <section className="mt-5 space-y-5">
          <Card className="overflow-visible border-border/70 bg-[hsl(var(--surface-overlay))] shadow-sm">
            <div className="relative z-30 border-b border-border/80 px-3 py-2.5 lg:px-3.5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.88fr)_minmax(0,1.1fr)_auto] xl:items-stretch">
                  <label className="relative min-h-10 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="h-10 rounded-[1rem] pl-9 text-[0.83rem]"
                      placeholder={t("prompts.searchPlaceholder")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  <div className="relative z-40 min-w-0">
                    <button
                      className="flex h-10 w-full items-center justify-between rounded-[1rem] border border-border/80 bg-[hsl(var(--surface))] px-3.5 text-left shadow-[0_12px_30px_-18px_rgba(15,23,42,0.12)] transition hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-muted))]"
                      type="button"
                      onClick={() =>
                        setIsCategoryMenuOpen((current) => !current)
                      }
                    >
                      <div className="min-w-0">
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))]">
                          {t("prompts.categoryLabel")}
                        </p>
                        <p className="truncate text-[0.72rem] font-semibold text-foreground">
                          {categoryLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedCategoryId !== "all" ? (
                          <Badge variant="accent">{t("prompts.filtered")}</Badge>
                        ) : null}
                      </div>
                    </button>

                    {isCategoryMenuOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-3xl border border-border/80 bg-[hsl(var(--surface-elevated))] shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)]">
                        <div className="border-b border-border/70 bg-[linear-gradient(180deg,_hsl(var(--theme-accent-muted)),_hsl(var(--surface-elevated)))] px-4 py-3">
                          <p className="text-sm font-semibold text-foreground">
                            {t("prompts.chooseCategory")}
                          </p>
                          <p className="text-xs text-[hsl(var(--foreground-soft))]">
                            {t("prompts.chooseCategoryDesc")}
                          </p>
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2">
                          <button
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition",
                              selectedCategoryId === "all"
                                ? "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]"
                                : "hover:bg-[hsl(var(--surface-muted))]",
                            )}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId("all");
                              setIsCategoryMenuOpen(false);
                            }}
                          >
                            <span className="font-medium">{t("prompts.allCategories")}</span>
                            {selectedCategoryId === "all" ? (
                              <Check className="h-4 w-4" />
                            ) : null}
                          </button>
                          {categoryOptions.map((category) => {
                            const isSelected =
                              selectedCategoryId === String(category.id);
                            return (
                              <button
                                key={category.id}
                                className={cn(
                                  "flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                                  isSelected
                                    ? "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]"
                                    : "hover:bg-[hsl(var(--surface-muted))]",
                                )}
                                type="button"
                                onClick={() => {
                                  setSelectedCategoryId(String(category.id));
                                  setIsCategoryMenuOpen(false);
                                }}
                              >
                                <span className="min-w-0">
                                  <span className="block font-medium">
                                    {category.name}
                                  </span>
                                  {category.description ? (
                                    <span className="block text-xs text-[hsl(var(--foreground-soft))]">
                                      {category.description}
                                    </span>
                                  ) : null}
                                </span>
                                {isSelected ? (
                                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="relative z-40 min-w-0">
                    <button
                      className="flex h-10 w-full items-center justify-between rounded-[1rem] border border-border/80 bg-[hsl(var(--surface))] px-3.5 text-left shadow-[0_12px_30px_-18px_rgba(15,23,42,0.12)] transition hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-muted))]"
                      type="button"
                      onClick={() => setIsTagsMenuOpen((current) => !current)}
                    >
                      <div className="min-w-0">
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))]">
                          {t("prompts.tagsLabel")}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden">
                          {selectedTags.length > 0 ? (
                            <>
                              {selectedTags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="accent" className="shrink-0 text-[0.6rem]">
                                  {tag}
                                </Badge>
                              ))}
                              {selectedTags.length > 2 ? (
                                <Badge variant="neutral" className="shrink-0 text-[0.6rem]">
                                  +{selectedTags.length - 2}
                                </Badge>
                              ) : null}
                            </>
                          ) : (
                            <span className="truncate text-[0.72rem] font-semibold text-foreground">
                              {t("prompts.addOrRemoveTags")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-[hsl(var(--foreground-soft))]" />
                      </div>
                    </button>

                    {isTagsMenuOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-3xl border border-border/80 bg-[hsl(var(--surface-elevated))] shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)]">
                        <div className="border-b border-border/70 bg-[linear-gradient(180deg,_hsl(var(--theme-accent-muted)),_hsl(var(--surface-elevated)))] px-4 py-3">
                          <p className="text-sm font-semibold text-foreground">
                            {t("prompts.manageTags")}
                          </p>
                          <p className="text-xs text-[hsl(var(--foreground-soft))]">
                            {t("prompts.manageTagsDesc")}
                          </p>
                        </div>

                        <div className="space-y-4 p-4">
                          <div className="flex gap-2">
                            <Input
                              className="flex-1"
                              placeholder={t("prompts.addATag")}
                              value={tagDraft}
                              onChange={(event) => setTagDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addTag(tagDraft);
                                }
                              }}
                            />
                            <Button type="button" onClick={() => addTag(tagDraft)}>
                              {t("prompts.add")}
                            </Button>
                          </div>

                          {selectedTags.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))]">
                                  {t("prompts.activeTags")}
                                </span>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                  onClick={() => setSelectedTags([])}
                                >
                                  {t("prompts.clearAll")}
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {selectedTags.map((tag) => (
                                  <button
                                    key={tag}
                                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    title={`Remove ${tag}`}
                                  >
                                    {tag}
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))]">
                                {t("prompts.suggestions")}
                              </span>
                              {suggestedTags.length > 0 ? (
                                <span className="text-xs text-[hsl(var(--foreground-soft))]">
                                  {t("prompts.clickToAdd")}
                                </span>
                              ) : null}
                            </div>
                            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-[hsl(var(--surface-muted))] p-2">
                              {suggestedTags.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {suggestedTags.map((tag) => (
                                    <button
                                      key={tag}
                                      className="inline-flex items-center gap-2 rounded-full border border-border bg-[hsl(var(--surface))] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-muted))] hover:text-[hsl(var(--theme-accent-soft-foreground))]"
                                      type="button"
                                      onClick={() => addTag(tag)}
                                    >
                                      <Plus className="h-3 w-3" />
                                      {tag}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="px-2 py-3 text-sm text-[hsl(var(--foreground-soft))]">
                                  {t("prompts.noTagsToSuggest")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                <div className="relative z-40 flex flex-wrap items-center gap-3 xl:justify-end">
                  {availableDifficulties.length > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--foreground-soft))]">
                        Difficulty
                      </span>
                      <div className="flex items-center gap-1.5">
                        {availableDifficulties.map((d) => {
                          const active = selectedDifficulties.includes(d);
                          const style = DIFFICULTY_STYLES[d] ?? "bg-slate-500 text-white";
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() =>
                                setSelectedDifficulties((current) =>
                                  current.includes(d)
                                    ? current.filter((x) => x !== d)
                                    : [...current, d],
                                )
                              }
                              className={cn(
                                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition",
                                style,
                                active ? "opacity-100 ring-2 ring-current ring-offset-1" : "opacity-30 hover:opacity-70",
                              )}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                    <Button
                      disabled={!hasAnyFilters}
                      type="button"
                      size="sm"
                      variant={hasAnyFilters ? "secondary" : "ghost"}
                      className="h-9 rounded-full px-3 text-xs font-semibold"
                      aria-label="Reset filters"
                      title="Reset filters"
                      onClick={() => {
                        setSearch("");
                        setSelectedCategoryId("all");
                        setSelectedTags([]);
                        setSelectedDifficulties([]);
                        setTagDraft("");
                        setIsCategoryMenuOpen(false);
                        setIsTagsMenuOpen(false);
                      }}
                      >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      aria-label={showArchived ? "Show unarchived prompts" : "Show archived prompts"}
                      className={cn(
                        showArchived &&
                          "border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))] shadow-[0_14px_28px_-18px_rgba(15,23,42,0.18)] hover:brightness-[0.98]",
                        )}
                      title={showArchived ? "Show unarchived" : "Show archived"}
                      type="button"
                      variant={showArchived ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setShowArchived((current) => !current)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button className="h-10 rounded-[1rem] px-4 text-[0.95rem]" onClick={openCreateModal}>
                      <Plus className="h-4 w-4" />
                      {t("prompts.newPrompt")}
                    </Button>
                  </div>
                </div>

              </div>
            </div>

            {loadError ? (
              <LoadErrorState
                message={loadError}
                onRetry={retryLoad}
                resourceLabel="the prompt library"
              />
            ) : null}

            {feedback ? (
              <div className="border-b border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-muted))] px-5 py-3 text-sm text-[hsl(var(--theme-accent-soft-foreground))]">
                {feedback}
              </div>
            ) : null}

            <div
              className={cn(
                "relative z-10",
                showArchived &&
                  "border-l-4 border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-muted)/0.56)] pl-0",
              )}
            >
              <table className="w-full table-fixed text-left">
                <thead className="bg-[hsl(var(--surface-muted))] text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--foreground-soft))]">
                  <tr>
                    <th className="w-8 px-3 py-2 font-semibold lg:px-3.5" />
                    <th className="w-[42%] px-3 py-2 font-semibold lg:px-3.5">{t("prompts.colName")}</th>
                    <th className="w-36 px-3 py-2 font-semibold lg:px-3.5">{t("prompts.colCategory")}</th>
                    <th className="w-10 px-3 py-2 font-semibold lg:px-3.5">
                      <div className="flex justify-center">
                        <Tag className="h-3.5 w-3.5 text-[hsl(var(--foreground-soft))]" />
                      </div>
                    </th>
                    <th className="w-20 px-3 py-2 font-semibold lg:px-3.5">{t("prompts.colUpdated")}</th>
                    <th className="w-16 px-3 py-2 font-semibold lg:px-3.5">{t("prompts.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {promptsQuery.isLoading ? (
                    <TableEmptyRow message={t("prompts.loading")} />
                  ) : visiblePrompts.length === 0 ? (
                    <TableEmptyRow
                      message={
                        showArchived
                          ? t("prompts.noArchivedYet")
                          : promptsQuery.data?.total === 0
                          ? t("prompts.emptySeeded")
                          : t("prompts.noMatchingFilters")
                      }
                    />
                  ) : (
                    visiblePrompts.map((prompt) => {
                      const isSelected = prompt.id === selectedPromptId;

                      return (
                        <tr
                          key={prompt.id}
                          className={cn(
                            "cursor-pointer border-t border-border/70 transition-colors hover:bg-amber-50",
                            isSelected && "bg-[hsl(var(--theme-accent-muted)/0.78)]",
                          )}
                        onClick={() => {
                          openEditModal(prompt);
                        }}
                      >
                          <td className="w-6 px-3 py-1.5 align-middle lg:px-3.5">
                            <DifficultyDot level={prompt.difficulty} />
                          </td>
                          <td className="min-w-0 px-3 py-1.5 align-middle lg:px-3.5">
                            <p
                              className="truncate text-[0.9rem] font-semibold text-foreground"
                              title={prompt.name}
                            >
                              {prompt.name}
                            </p>
                          </td>
                          <td className="px-3 py-1.5 align-middle lg:px-3.5">
                            <Badge variant="accent" className="whitespace-nowrap">{prompt.category.name}</Badge>
                          </td>
                          <td className="px-3 py-1.5 align-middle lg:px-3.5" onClick={(e) => e.stopPropagation()}>
                            {prompt.tags.length > 0 ? (
                              <div className="flex justify-center">
                                <button
                                  type="button"
                                  className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-[hsl(var(--surface-muted))] text-[hsl(var(--foreground-soft))] transition hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-muted))] hover:text-[hsl(var(--theme-accent-soft-foreground))]"
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setTagsTooltip({ tags: prompt.tags, x: rect.left + rect.width / 2, y: rect.top });
                                  }}
                                  onMouseLeave={() => setTagsTooltip(null)}
                                >
                                  <Tag className="h-3 w-3" />
                                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold leading-none text-white">
                                    {prompt.tags.length}
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <span className="flex justify-center text-[hsl(var(--foreground-soft))] opacity-30">
                                <Tag className="h-3 w-3" />
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 align-middle text-[0.84rem] text-[hsl(var(--foreground-soft))] lg:px-3.5">
                            <span title={formatDateFull(prompt.updated_at)}>
                              {formatDateShort(prompt.updated_at)}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 align-middle lg:px-3.5" onClick={(event) => event.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              <Button
                                aria-label={`Archive ${prompt.name}`}
                                disabled={prompt.is_archived || archiveMutation.isPending}
                                size="iconSm"
                                title={`Archive ${prompt.name}`}
                                variant="dangerSoft"
                                onClick={() => archiveMutation.mutate(prompt.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>

      <Modal
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
        title={selectedPrompt ? t("prompts.editModal.title") : t("prompts.createModal.title")}
      >
        <form className="space-y-3.5">
          {loadError ? (
            <LoadErrorState compact message={loadError} resourceLabel={t("prompts.pageTitle")} />
          ) : null}

          {/* Name + Category */}
          <div className="grid gap-3 sm:grid-cols-2">
            <PromptModalField label={t("prompts.form.name")}>
              <Input
                placeholder={t("prompts.form.namePlaceholder")}
                value={formState.name}
                onChange={(event) =>
                  updateForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </PromptModalField>

            <PromptModalField label={t("prompts.form.category")}>
              <div className="flex flex-wrap gap-1">
                {(categoriesQuery.data ?? []).map((category) => {
                  const isSelected = formState.categoryId === String(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() =>
                        updateForm((current) => ({ ...current, categoryId: String(category.id) }))
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
                        isSelected
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-border bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
                      )}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </PromptModalField>
          </div>

          {/* Tags + Difficulty */}
          <div className="grid gap-3 sm:grid-cols-2">
            <PromptModalField label={t("prompts.form.tags")}>
              {/* Active tags + free-type input */}
              <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border bg-white px-2 py-1.5">
                {formTagList.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                  >
                    {tag}
                    <button
                      type="button"
                      className="text-amber-400 hover:text-amber-700"
                      onClick={() => removeFormTag(tag)}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  className="min-w-[5rem] flex-1 bg-transparent text-[11px] font-medium text-slate-700 outline-none placeholder:text-slate-300"
                  placeholder={formTagList.length === 0 ? t("prompts.form.tagsPlaceholder") : ""}
                  value={formTagInput}
                  onChange={(event) => setFormTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      const value = formTagInput.trim();
                      if (value) {
                        addFormTag(value);
                        setFormTagInput("");
                      }
                    } else if (event.key === "Backspace" && formTagInput === "") {
                      if (formTagList.length > 0) {
                        removeFormTag(formTagList[formTagList.length - 1]);
                      }
                    }
                  }}
                />
              </div>
              {/* Smart suggestions — filtered by what's typed, max 3 */}
              <div className="mt-1.5 flex min-h-[1.5rem] items-center gap-1.5">
                {formTagFiltered.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => { addFormTag(tag); setFormTagInput(""); }}
                    className="rounded-full border border-dashed border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                  >
                    + {tag}
                  </button>
                ))}
                {formTagFiltered.length === 0 && formTagInput.trim() ? (
                  <span className="text-[11px] text-slate-400">
                    Entrée pour créer <span className="font-semibold text-amber-600">«&nbsp;{formTagInput.trim()}&nbsp;»</span>
                  </span>
                ) : null}
              </div>
            </PromptModalField>

            <PromptModalField label={t("prompts.form.difficulty")}>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as const).map((level) => {
                  const isSelected = formState.difficulty === level;
                  const activeStyle: Record<number, string> = {
                    1: "bg-emerald-400 border-emerald-400 text-white",
                    2: "bg-lime-400 border-lime-400 text-white",
                    3: "bg-amber-400 border-amber-400 text-white",
                    4: "bg-orange-500 border-orange-500 text-white",
                    5: "bg-red-500 border-red-500 text-white",
                  };
                  const hoverStyle: Record<number, string> = {
                    1: "hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700",
                    2: "hover:bg-lime-50 hover:border-lime-300 hover:text-lime-700",
                    3: "hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700",
                    4: "hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700",
                    5: "hover:bg-red-50 hover:border-red-300 hover:text-red-700",
                  };
                  return (
                    <button
                      key={level}
                      type="button"
                      title={DIFFICULTY_LABELS[level]}
                      className={cn(
                        "flex flex-1 flex-col items-center justify-center rounded-lg border px-1 py-2 text-xs font-bold transition-all",
                        isSelected
                          ? activeStyle[level]
                          : cn("border-border bg-white text-slate-400", hoverStyle[level]),
                      )}
                      onClick={() =>
                        updateForm((current) => ({
                          ...current,
                          difficulty: current.difficulty === level ? null : level,
                        }))
                      }
                    >
                      {level}
                      <span className="mt-0.5 text-[9px] font-medium leading-none opacity-70">
                        {DIFFICULTY_LABELS[level]?.split(" ").pop()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </PromptModalField>
          </div>

          {/* Description */}
          <PromptModalField label={t("prompts.form.description")}>
            <Textarea
              className="min-h-16"
              placeholder={t("prompts.form.descriptionPlaceholder")}
              value={formState.description}
              onChange={(event) =>
                updateForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </PromptModalField>

          {/* System Prompt */}
          <PromptModalField label={t("prompts.form.systemPrompt")}>
            <Textarea
              placeholder={t("prompts.form.systemPromptPlaceholder")}
              value={formState.systemPromptText}
              onChange={(event) =>
                updateForm((current) => ({ ...current, systemPromptText: event.target.value }))
              }
            />
          </PromptModalField>

          {/* User Prompt */}
          <PromptModalField label={t("prompts.form.userPrompt")}>
            <Textarea
              className="min-h-36"
              placeholder={t("prompts.form.userPromptPlaceholder")}
              value={formState.userPromptText}
              onChange={(event) =>
                updateForm((current) => ({ ...current, userPromptText: event.target.value }))
              }
            />
          </PromptModalField>

          {/* Evaluation Notes */}
          <PromptModalField label={t("prompts.form.evaluationNotes")}>
            <Textarea
              placeholder={t("prompts.form.evaluationNotesPlaceholder")}
              value={formState.evaluationNotes}
              onChange={(event) =>
                updateForm((current) => ({ ...current, evaluationNotes: event.target.value }))
              }
            />
          </PromptModalField>

          {/* Active toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              checked={formState.isActive}
              className="h-4 w-4 rounded border-border"
              onChange={(event) =>
                updateForm((current) => ({ ...current, isActive: event.target.checked }))
              }
              type="checkbox"
            />
            {t("prompts.form.isActive")}
          </label>

          {feedback ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {feedback}
            </div>
          ) : null}
        </form>
      </Modal>

      {tagsTooltip && (
        <div
          className="pointer-events-none fixed z-[9999] w-56 rounded-2xl border border-border/80 bg-[hsl(var(--surface-elevated))] p-3 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.22)]"
          style={{ left: tagsTooltip.x, top: tagsTooltip.y, transform: "translate(-50%, calc(-100% - 10px))" }}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground-soft))]">
            Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tagsTooltip.tags.map((tag) => (
              <Badge key={tag} variant="neutral" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-border/80 bg-[hsl(var(--surface-elevated))]" />
        </div>
      )}
    </div>
  );
}

function TableEmptyRow({ message }: { message: string }) {
  return (
    <tr className="border-t border-border/70">
      <td className="px-5 py-12 text-center text-sm text-slate-500" colSpan={6}>
        {message}
      </td>
    </tr>
  );
}

function PromptModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}
