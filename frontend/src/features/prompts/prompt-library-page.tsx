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
import type { Prompt } from "@/features/prompts/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  PROMPT_FILTERS_STORAGE_KEY,
  emptyForm,
} from "./constants";
import {
  artifactCount,
  formatDateFull,
  formatDateShort,
  getCategoryLabel,
  isJsonValid,
  matchesArchiveState,
  matchesCategory,
  matchesDifficulty,
  matchesSearch,
  matchesTags,
  readPromptFilterState,
  renderScenarioPromptPreview,
  toFormState,
  toPayload,
  uniqueTags,
} from "./utils";
import { DifficultyDot } from "./components/difficulty-dot";
import { PromptModalField } from "./components/prompt-modal-field";
import { TableEmptyRow } from "./components/table-empty-row";

export function PromptLibraryPage() {
  const { t } = useTranslation();
  const initialFilters = readPromptFilterState();
  const [showArchived, setShowArchived] = useState(initialFilters.showArchived);
  const [search, setSearch] = useState(initialFilters.search);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialFilters.selectedCategoryId);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialFilters.selectedTags);
  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>(initialFilters.selectedDifficulties);
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
    const jsonFields = [
      formState.inputArtifactsJson,
      formState.constraintsJson,
      formState.expectedBehaviorJson,
      formState.goldFactsJson,
      formState.judgeRubricJson,
    ];
    const isValid =
      formState.name.trim() &&
      formState.userPromptText.trim() &&
      formState.categoryId &&
      jsonFields.every(isJsonValid);
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
      JSON.stringify({ showArchived, search, selectedCategoryId, selectedTags, selectedDifficulties }),
    );
  }, [search, selectedCategoryId, selectedTags, selectedDifficulties, showArchived]);

  const saveMutation = useMutation({
    mutationFn: async (payload: PromptPayload) => {
      if (selectedPrompt) return updatePrompt(selectedPrompt.id, payload);
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
      setFeedback(error instanceof ApiError ? error.message : t("prompts.feedback.errorSave"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archivePrompt,
    onSuccess: async (prompt) => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      setFeedback(t("prompts.feedback.archived", { name: prompt.name }));
      startTransition(() => setSelectedPrompt(null));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("prompts.feedback.errorArchive"));
    },
  });

  const scopedPrompts = (promptsQuery.data?.items ?? []).filter((p) =>
    matchesArchiveState(p, showArchived),
  );
  const promptTags = uniqueTags(scopedPrompts);
  const categoryOptions = categoriesQuery.data ?? [];
  const categoryLabel = getCategoryLabel(categoryOptions, selectedCategoryId, t("prompts.allCategories"));
  const tagOptions = useMemo(
    () => Array.from(new Set([...promptTags, ...selectedTags])).sort((a, b) => a.localeCompare(b)),
    [promptTags, selectedTags],
  );
  const suggestedTags = tagOptions.filter(
    (tag) => !selectedTags.some((item) => item.toLowerCase() === tag.toLowerCase()),
  );
  const visiblePrompts = scopedPrompts.filter(
    (p) =>
      matchesSearch(p, search) &&
      matchesCategory(p, selectedCategoryId) &&
      matchesTags(p, selectedTags) &&
      matchesDifficulty(p, selectedDifficulties),
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
        categoryId: current.categoryId || (categoriesQuery.data?.[0] ? String(categoriesQuery.data[0].id) : ""),
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
    if (!normalized) return;
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
    const next = formState.tags.split(",").map((item) => item.trim()).filter((item) => item !== tag);
    updateForm((current) => ({ ...current, tags: next.join(", ") }));
  };

  const formTagList = formState.tags.split(",").map((item) => item.trim()).filter(Boolean);
  const formTagSuggestions = promptTags.filter(
    (tag) => !formTagList.some((item) => item.toLowerCase() === tag.toLowerCase()),
  );
  const formTagFiltered = formTagSuggestions
    .filter((tag) => !formTagInput.trim() || tag.toLowerCase().includes(formTagInput.trim().toLowerCase()))
    .slice(0, 3);

  const selectedPromptId = selectedPrompt?.id ?? null;
  const renderedPromptPreview = useMemo(
    () => renderScenarioPromptPreview(formState),
    [formState],
  );

  const resetFilters = () => {
    setSearch("");
    setSelectedCategoryId("all");
    setSelectedTags([]);
    setSelectedDifficulties([]);
    setTagDraft("");
    setIsCategoryMenuOpen(false);
    setIsTagsMenuOpen(false);
  };

  return (
    <div className="text-foreground">
      {/* ── Page header ── */}
      <header className="px-6 lg:px-8 pt-8 pb-6 border-b border-border/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.28em] text-primary/80 mb-1.5">
              {t("prompts.reusableAssets")}
            </p>
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground leading-none">
              {t("prompts.pageTitle")}
            </h1>
            <div className="flex items-center gap-1 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-semibold text-foreground">{visiblePrompts.length}</span>{" "}
                    scenarios
                  </span>
              </div>
              <span className="text-border/60 mx-1.5">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Shapes className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{categoryCount}</span>{" "}
                  {t("prompts.metricCategories").toLowerCase()}
                </span>
              </div>
              <span className="text-border/60 mx-1.5">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">
                    {(categoriesQuery.data ?? []).filter((c) => c.is_system).length}
                  </span>{" "}
                  {t("prompts.metricSystemPacks").toLowerCase()}
                </span>
              </div>
            </div>
          </div>

          <Button className="shrink-0" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            New scenario
          </Button>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div className="px-6 lg:px-8 py-3 border-b border-border/40 flex items-center gap-2 flex-wrap">
        {/* Search */}
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-9 w-52 pl-8 text-sm rounded-lg"
            placeholder={t("prompts.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        {/* Category dropdown */}
        <div className="relative z-40">
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-medium transition",
              selectedCategoryId !== "all"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
            )}
            onClick={() => { setIsCategoryMenuOpen((v) => !v); setIsTagsMenuOpen(false); }}
          >
            {categoryLabel}
            {selectedCategoryId !== "all" ? (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCategoryId("all");
                  setIsCategoryMenuOpen(false);
                }}
              />
            ) : null}
          </button>

          {isCategoryMenuOpen ? (
            <div className="absolute left-0 top-[calc(100%+0.4rem)] z-[90] min-w-[14rem] overflow-hidden rounded-xl border border-border bg-[hsl(var(--surface-elevated))] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.5)]">
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-[0.78rem] font-semibold text-foreground">{t("prompts.chooseCategory")}</p>
                <p className="text-[0.68rem] text-muted-foreground mt-0.5">{t("prompts.chooseCategoryDesc")}</p>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-[0.82rem] transition",
                    selectedCategoryId === "all"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-[hsl(var(--surface-muted))]",
                  )}
                  type="button"
                  onClick={() => { setSelectedCategoryId("all"); setIsCategoryMenuOpen(false); }}
                >
                  <span>{t("prompts.allCategories")}</span>
                  {selectedCategoryId === "all" ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
                {categoryOptions.map((cat) => {
                  const isSelected = selectedCategoryId === String(cat.id);
                  return (
                    <button
                      key={cat.id}
                      className={cn(
                        "flex w-full items-start justify-between gap-2 px-3 py-2.5 text-[0.82rem] text-left transition",
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-[hsl(var(--surface-muted))]",
                      )}
                      type="button"
                      onClick={() => { setSelectedCategoryId(String(cat.id)); setIsCategoryMenuOpen(false); }}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{cat.name}</span>
                        {cat.description ? (
                          <span className="block text-[0.68rem] text-muted-foreground">{cat.description}</span>
                        ) : null}
                      </span>
                      {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Tags dropdown */}
        <div className="relative z-40">
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-medium transition",
              selectedTags.length > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
            )}
            onClick={() => { setIsTagsMenuOpen((v) => !v); setIsCategoryMenuOpen(false); }}
          >
            <Tag className="h-3.5 w-3.5" />
            {selectedTags.length > 0
              ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""}`
              : t("prompts.tagsLabel")}
          </button>

          {isTagsMenuOpen ? (
            <div className="absolute left-0 top-[calc(100%+0.4rem)] z-[90] w-72 overflow-hidden rounded-xl border border-border bg-[hsl(var(--surface-elevated))] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.5)]">
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-[0.78rem] font-semibold text-foreground">{t("prompts.manageTags")}</p>
                <p className="text-[0.68rem] text-muted-foreground mt-0.5">{t("prompts.manageTagsDesc")}</p>
              </div>
              <div className="p-3 space-y-3">
                <div className="flex gap-2">
                  <Input
                    className="flex-1 h-8 text-sm"
                    placeholder={t("prompts.addATag")}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addTag(tagDraft); }
                    }}
                  />
                  <Button size="sm" type="button" onClick={() => addTag(tagDraft)}>
                    {t("prompts.add")}
                  </Button>
                </div>

                {selectedTags.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("prompts.activeTags")}
                      </span>
                      <button
                        type="button"
                        className="text-[0.68rem] text-muted-foreground hover:text-foreground transition"
                        onClick={() => setSelectedTags([])}
                      >
                        {t("prompts.clearAll")}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-primary transition hover:bg-primary/20"
                          onClick={() => removeTag(tag)}
                        >
                          {tag}
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("prompts.suggestions")}
                    </span>
                    {suggestedTags.length > 0 ? (
                      <span className="text-[0.62rem] text-muted-foreground">{t("prompts.clickToAdd")}</span>
                    ) : null}
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-border/60 bg-[hsl(var(--surface-muted))] p-2">
                    {suggestedTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-[hsl(var(--surface))] px-2.5 py-0.5 text-[0.7rem] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                            onClick={() => addTag(tag)}
                          >
                            <Plus className="h-2.5 w-2.5" />
                            {tag}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="py-2 px-1 text-xs text-muted-foreground">
                        {t("prompts.noTagsToSuggest")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Difficulty dots */}
        {availableDifficulties.length > 0 ? (
          <div className="flex items-center gap-1 ml-0.5">
            {availableDifficulties.map((d) => {
              const active = selectedDifficulties.includes(d);
              const style = DIFFICULTY_STYLES[d] ?? "bg-slate-500 text-white";
              return (
                <button
                  key={d}
                  type="button"
                  title={DIFFICULTY_LABELS[d]}
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.62rem] font-bold transition",
                    style,
                    active
                      ? "opacity-100 ring-2 ring-current ring-offset-1 ring-offset-background"
                      : "opacity-25 hover:opacity-60",
                  )}
                  onClick={() =>
                    setSelectedDifficulties((current) =>
                      current.includes(d) ? current.filter((x) => x !== d) : [...current, d],
                    )
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Reset + Archive */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasAnyFilters}
            title="Reset filters"
            aria-label="Reset filters"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
              hasAnyFilters
                ? "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-muted))]"
                : "text-muted-foreground/25 cursor-default",
            )}
            onClick={resetFilters}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={showArchived ? "Show active scenarios" : "Show archived scenarios"}
            aria-label={showArchived ? "Show active scenarios" : "Show archived scenarios"}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
              showArchived
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-muted))]",
            )}
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Error state */}
      {loadError ? (
        <LoadErrorState message={loadError} onRetry={retryLoad} resourceLabel="the scenario library" />
      ) : null}

      {/* Feedback strip */}
      {feedback ? (
        <div className="border-b border-primary/20 bg-primary/5 px-6 lg:px-8 py-2.5 text-[0.82rem] text-primary">
          {feedback}
        </div>
      ) : null}

      {/* ── Table ── */}
      <div className={cn(showArchived && "border-l-2 border-primary/25")}>
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-border/50">
              <th className="w-12 px-6 lg:px-8 py-2.5" />
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground w-[44%]">
                {t("prompts.colName")}
              </th>
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground w-32">
                Type
              </th>
              <th className="w-12 px-4 py-2.5">
                <div className="flex justify-center">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </th>
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground w-20">
                {t("prompts.colUpdated")}
              </th>
              <th className="w-14 px-4 py-2.5" />
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
                      "group border-b border-border/30 cursor-pointer transition-colors duration-100",
                      isSelected
                        ? "bg-primary/5"
                        : "hover:bg-[hsl(var(--surface-muted)/0.6)]",
                    )}
                    onClick={() => openEditModal(prompt)}
                  >
                    <td className="px-6 lg:px-8 py-3.5 align-middle">
                      <DifficultyDot level={prompt.difficulty} />
                    </td>
                    <td className="min-w-0 px-4 py-3.5 align-middle">
                      <p
                        className="truncate text-[0.88rem] font-medium text-foreground"
                        title={prompt.name}
                      >
                        {prompt.name}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                          {prompt.category.name}
                        </Badge>
                        {prompt.scenario_type ? (
                          <Badge variant="neutral" className="whitespace-nowrap text-[0.7rem]">
                            {prompt.scenario_type}
                          </Badge>
                        ) : null}
                        {prompt.cost_tier ? (
                          <Badge variant="neutral" className="whitespace-nowrap text-[0.7rem]">
                            {prompt.cost_tier}
                          </Badge>
                        ) : null}
                        {prompt.weight ? (
                          <Badge variant="neutral" className="whitespace-nowrap text-[0.7rem]">
                            w{prompt.weight}
                          </Badge>
                        ) : null}
                        {artifactCount(prompt) > 0 ? (
                          <Badge variant="neutral" className="whitespace-nowrap text-[0.7rem]">
                            {artifactCount(prompt)} artifacts
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3.5 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {prompt.tags.length > 0 ? (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            className="relative flex h-7 w-7 items-center justify-center rounded-md border border-border/50 bg-[hsl(var(--surface-muted))] text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTagsTooltip({ tags: prompt.tags, x: rect.left + rect.width / 2, y: rect.top });
                            }}
                            onMouseLeave={() => setTagsTooltip(null)}
                          >
                            <Tag className="h-3 w-3" />
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                              {prompt.tags.length}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <span className="flex justify-center text-muted-foreground/20">
                          <Tag className="h-3 w-3" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle text-[0.78rem] text-muted-foreground">
                      <span title={formatDateFull(prompt.updated_at)}>
                        {formatDateShort(prompt.updated_at)}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3.5 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          aria-label={`Archive ${prompt.name}`}
                          disabled={prompt.is_archived || archiveMutation.isPending}
                          size="iconSm"
                          title={`Archive ${prompt.name}`}
                          variant="dangerSoft"
                          onClick={() => archiveMutation.mutate(prompt.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* ── Create / Edit modal ── */}
      <Modal
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
        size="xl"
        title={selectedPrompt ? t("prompts.editModal.title") : t("prompts.createModal.title")}
      >
        {loadError ? (
          <LoadErrorState compact message={loadError} resourceLabel={t("prompts.pageTitle")} />
        ) : null}

        {feedback ? (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/8 px-4 py-2.5 text-[0.82rem] text-primary">
            {feedback}
          </div>
        ) : null}

        <form>
          {/* Two-column layout */}
          <div className="flex gap-0 min-h-0">
            {/* ── Left panel: meta ── */}
            <div className="w-56 shrink-0 space-y-5 pr-6 border-r border-border/50">

              {/* Name */}
              <PromptModalField label={t("prompts.form.name")} required>
                <Input
                  placeholder={t("prompts.form.namePlaceholder")}
                  value={formState.name}
                  onChange={(e) => updateForm((c) => ({ ...c, name: e.target.value }))}
                />
              </PromptModalField>

              {/* Category */}
              <PromptModalField label={t("prompts.form.category")}>
                <div className="flex flex-wrap gap-1.5">
                  {(categoriesQuery.data ?? []).map((category) => {
                    const isSelected = formState.categoryId === String(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => updateForm((c) => ({ ...c, categoryId: String(category.id) }))}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium transition-all",
                          isSelected
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-[hsl(var(--surface-muted))] text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </PromptModalField>

              {/* Difficulty */}
              <PromptModalField label={t("prompts.form.difficulty")}>
                <div className="flex gap-1">
                  {([1, 2, 3, 4, 5] as const).map((level) => {
                    const isSelected = formState.difficulty === level;
                    const activeStyle: Record<number, string> = {
                      1: "bg-emerald-500 border-emerald-500 text-white",
                      2: "bg-lime-500 border-lime-500 text-white",
                      3: "bg-amber-500 border-amber-500 text-white",
                      4: "bg-orange-500 border-orange-500 text-white",
                      5: "bg-red-500 border-red-500 text-white",
                    };
                    return (
                      <button
                        key={level}
                        type="button"
                        title={DIFFICULTY_LABELS[level]}
                        className={cn(
                          "flex flex-1 flex-col items-center justify-center rounded-lg border py-2 text-xs font-bold transition-all",
                          isSelected
                            ? activeStyle[level]
                            : "border-border bg-[hsl(var(--surface-muted))] text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() =>
                          updateForm((c) => ({
                            ...c,
                            difficulty: c.difficulty === level ? null : level,
                          }))
                        }
                      >
                        {level}
                        <span className="mt-0.5 text-[8px] font-normal leading-none opacity-60">
                          {DIFFICULTY_LABELS[level]?.split(" ").pop()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </PromptModalField>

              {/* Tags */}
              <PromptModalField label={t("prompts.form.tags")}>
                <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border bg-[hsl(var(--surface))] px-2 py-1.5">
                  {formTagList.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary"
                    >
                      {tag}
                      <button
                        type="button"
                        className="text-primary/50 hover:text-primary transition"
                        onClick={() => removeFormTag(tag)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    className="min-w-[3rem] flex-1 bg-transparent text-[0.75rem] text-foreground outline-none placeholder:text-muted-foreground/40"
                    placeholder={formTagList.length === 0 ? t("prompts.form.tagsPlaceholder") : ""}
                    value={formTagInput}
                    onChange={(e) => setFormTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const value = formTagInput.trim();
                        if (value) { addFormTag(value); setFormTagInput(""); }
                      } else if (e.key === "Backspace" && formTagInput === "") {
                        if (formTagList.length > 0) removeFormTag(formTagList[formTagList.length - 1]);
                      }
                    }}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {formTagFiltered.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => { addFormTag(tag); setFormTagInput(""); }}
                      className="rounded-full border border-dashed border-border/50 px-2 py-0.5 text-[0.65rem] text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                    >
                      + {tag}
                    </button>
                  ))}
                  {formTagFiltered.length === 0 && formTagInput.trim() ? (
                    <span className="text-[0.65rem] text-muted-foreground">
                      ↵ créer{" "}
                      <span className="font-semibold text-primary">«&nbsp;{formTagInput.trim()}&nbsp;»</span>
                    </span>
                  ) : null}
                </div>
              </PromptModalField>

              {/* Description */}
              <PromptModalField label={t("prompts.form.description")}>
                <Textarea
                  className="min-h-[4rem] text-sm resize-none"
                  placeholder={t("prompts.form.descriptionPlaceholder")}
                  value={formState.description}
                  onChange={(e) => updateForm((c) => ({ ...c, description: e.target.value }))}
                />
              </PromptModalField>

              <PromptModalField label="Scenario type">
                <Input
                  placeholder="code_debug"
                  value={formState.scenarioType}
                  onChange={(e) => updateForm((c) => ({ ...c, scenarioType: e.target.value }))}
                />
              </PromptModalField>

              <PromptModalField label="Cost / weight">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="low"
                    value={formState.costTier}
                    onChange={(e) => updateForm((c) => ({ ...c, costTier: e.target.value }))}
                  />
                  <Input
                    min={1}
                    type="number"
                    value={formState.weight}
                    onChange={(e) => updateForm((c) => ({ ...c, weight: e.target.value }))}
                  />
                </div>
              </PromptModalField>

              <PromptModalField label="Tokens / version">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    min={0}
                    placeholder="500"
                    type="number"
                    value={formState.estimatedInputTokens}
                    onChange={(e) => updateForm((c) => ({ ...c, estimatedInputTokens: e.target.value }))}
                  />
                  <Input
                    placeholder="1.0"
                    value={formState.version}
                    onChange={(e) => updateForm((c) => ({ ...c, version: e.target.value }))}
                  />
                </div>
              </PromptModalField>

              {/* Active toggle */}
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/60 bg-[hsl(var(--surface-muted))] px-3 py-2 text-[0.78rem] text-foreground transition hover:bg-[hsl(var(--surface-elevated))]">
                <input
                  checked={formState.isActive}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                  onChange={(e) => updateForm((c) => ({ ...c, isActive: e.target.checked }))}
                  type="checkbox"
                />
                {t("prompts.form.isActive")}
              </label>
            </div>

            {/* ── Right panel: content ── */}
            <div className="min-w-0 flex-1 space-y-5 pl-6">

              {/* System instruction */}
              <PromptModalField label={t("prompts.form.systemPrompt")}>
                <Textarea
                  className="min-h-[7rem] font-mono text-[0.78rem] leading-relaxed resize-y"
                  placeholder={t("prompts.form.systemPromptPlaceholder")}
                  value={formState.systemPromptText}
                  onChange={(e) => updateForm((c) => ({ ...c, systemPromptText: e.target.value }))}
                />
              </PromptModalField>

              <PromptModalField label="Objective">
                <Textarea
                  className="min-h-[4rem] text-sm resize-y"
                  placeholder="What the candidate model must accomplish"
                  value={formState.objective}
                  onChange={(e) => updateForm((c) => ({ ...c, objective: e.target.value }))}
                />
              </PromptModalField>

              <PromptModalField label="Context">
                <Textarea
                  className="min-h-[5rem] text-sm resize-y"
                  placeholder="Business or technical context for the scenario"
                  value={formState.context}
                  onChange={(e) => updateForm((c) => ({ ...c, context: e.target.value }))}
                />
              </PromptModalField>

              {/* User task */}
              <PromptModalField label={t("prompts.form.userPrompt")} required>
                <Textarea
                  className="min-h-[14rem] font-mono text-[0.78rem] leading-relaxed resize-y"
                  placeholder={t("prompts.form.userPromptPlaceholder")}
                  value={formState.userPromptText}
                  onChange={(e) => updateForm((c) => ({ ...c, userPromptText: e.target.value }))}
                />
              </PromptModalField>

              <PromptModalField label="Artifacts JSON">
                <Textarea
                  className={cn("min-h-[9rem] font-mono text-[0.75rem] leading-relaxed resize-y", !isJsonValid(formState.inputArtifactsJson) && "border-destructive")}
                  value={formState.inputArtifactsJson}
                  onChange={(e) => updateForm((c) => ({ ...c, inputArtifactsJson: e.target.value }))}
                />
              </PromptModalField>

              <PromptModalField label="Constraints JSON">
                <Textarea
                  className={cn("min-h-[6rem] font-mono text-[0.75rem] leading-relaxed resize-y", !isJsonValid(formState.constraintsJson) && "border-destructive")}
                  value={formState.constraintsJson}
                  onChange={(e) => updateForm((c) => ({ ...c, constraintsJson: e.target.value }))}
                />
              </PromptModalField>

              <PromptModalField label="Expected output format">
                <Textarea
                  className="min-h-[4rem] text-sm resize-y"
                  value={formState.expectedOutputFormat}
                  onChange={(e) => updateForm((c) => ({ ...c, expectedOutputFormat: e.target.value }))}
                />
              </PromptModalField>

              <div className="grid gap-4 md:grid-cols-2">
                <PromptModalField label="Gold facts JSON">
                  <Textarea
                    className={cn("min-h-[9rem] font-mono text-[0.72rem] leading-relaxed resize-y", !isJsonValid(formState.goldFactsJson) && "border-destructive")}
                    value={formState.goldFactsJson}
                    onChange={(e) => updateForm((c) => ({ ...c, goldFactsJson: e.target.value }))}
                  />
                </PromptModalField>
                <PromptModalField label="Rubric JSON">
                  <Textarea
                    className={cn("min-h-[9rem] font-mono text-[0.72rem] leading-relaxed resize-y", !isJsonValid(formState.judgeRubricJson) && "border-destructive")}
                    value={formState.judgeRubricJson}
                    onChange={(e) => updateForm((c) => ({ ...c, judgeRubricJson: e.target.value }))}
                  />
                </PromptModalField>
              </div>

              <PromptModalField label="Expected behavior JSON">
                <Textarea
                  className={cn("min-h-[6rem] font-mono text-[0.75rem] leading-relaxed resize-y", !isJsonValid(formState.expectedBehaviorJson) && "border-destructive")}
                  value={formState.expectedBehaviorJson}
                  onChange={(e) => updateForm((c) => ({ ...c, expectedBehaviorJson: e.target.value }))}
                />
              </PromptModalField>

              <PromptModalField label="Rendered scenario preview">
                <Textarea
                  className="min-h-[18rem] bg-[hsl(var(--surface-muted))] font-mono text-[0.75rem] leading-relaxed text-muted-foreground resize-y"
                  readOnly
                  value={renderedPromptPreview}
                />
              </PromptModalField>

              {/* Evaluation Notes */}
              <PromptModalField label={t("prompts.form.evaluationNotes")}>
                <Textarea
                  className="min-h-[5rem] text-sm resize-y"
                  placeholder={t("prompts.form.evaluationNotesPlaceholder")}
                  value={formState.evaluationNotes}
                  onChange={(e) => updateForm((c) => ({ ...c, evaluationNotes: e.target.value }))}
                />
              </PromptModalField>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Tags tooltip ── */}
      {tagsTooltip ? (
        <div
          className="pointer-events-none fixed z-[9999] w-52 rounded-xl border border-border bg-[hsl(var(--surface-elevated))] p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]"
          style={{
            left: tagsTooltip.x,
            top: tagsTooltip.y,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tagsTooltip.tags.map((tag) => (
              <Badge key={tag} variant="neutral" className="text-[0.65rem]">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-border bg-[hsl(var(--surface-elevated))]" />
        </div>
      ) : null}
    </div>
  );
}

