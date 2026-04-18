import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type PromptFormState = {
  name: string;
  description: string;
  categoryId: string;
  tags: string;
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
    is_active: state.isActive,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
): string {
  if (selectedCategoryId === "all") {
    return "All categories";
  }

  return (
    categories.find((category) => String(category.id) === selectedCategoryId)
      ?.name ?? "Selected category"
  );
}

type PromptFilterState = {
  showArchived: boolean;
  search: string;
  selectedCategoryId: string;
  selectedTags: string[];
};

const PROMPT_FILTERS_STORAGE_KEY = "benchforge.prompt-library.filters";

function readPromptFilterState(): PromptFilterState {
  if (typeof window === "undefined") {
    return {
      showArchived: false,
      search: "",
      selectedCategoryId: "all",
      selectedTags: [],
    };
  }

  const raw = window.localStorage.getItem(PROMPT_FILTERS_STORAGE_KEY);
  if (!raw) {
    return {
      showArchived: false,
      search: "",
      selectedCategoryId: "all",
      selectedTags: [],
    };
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
    };
  } catch {
    return {
      showArchived: false,
      search: "",
      selectedCategoryId: "all",
      selectedTags: [],
    };
  }
}

export function PromptLibraryPage() {
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
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isTagsMenuOpen, setIsTagsMenuOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formState, setFormState] = useState<PromptFormState>(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const categoriesQuery = useQuery({
    queryKey: ["prompt-categories"],
    queryFn: fetchPromptCategories,
  });

  const promptsQuery = useQuery({
    queryKey: ["prompts", showArchived],
    queryFn: () => fetchPrompts(showArchived),
  });

  useEffect(() => {
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
      }),
    );
  }, [search, selectedCategoryId, selectedTags, showArchived]);

  const saveMutation = useMutation({
    mutationFn: async (payload: PromptPayload) => {
      if (selectedPrompt) {
        return updatePrompt(selectedPrompt.id, payload);
      }
      return createPrompt(payload);
    },
    onSuccess: async (prompt) => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      setFeedback(
        selectedPrompt
          ? `Prompt "${prompt.name}" updated.`
          : `Prompt "${prompt.name}" created.`,
      );
      setIsEditorOpen(false);
      startTransition(() => {
        setSelectedPrompt(prompt);
        setFormState(toFormState(prompt));
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : "Unable to save prompt.",
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archivePrompt,
    onSuccess: async (prompt) => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      setFeedback(`Prompt "${prompt.name}" archived.`);
      startTransition(() => {
        setSelectedPrompt(null);
      });
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : "Unable to archive prompt.",
      );
    },
  });

  const scopedPrompts = (promptsQuery.data?.items ?? []).filter((prompt) =>
    matchesArchiveState(prompt, showArchived),
  );
  const promptTags = uniqueTags(scopedPrompts);
  const categoryOptions = categoriesQuery.data ?? [];
  const categoryLabel = getCategoryLabel(categoryOptions, selectedCategoryId);
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
      matchesTags(prompt, selectedTags),
  );
  const categoryCount = categoriesQuery.data?.length ?? 0;
  const hasAnyFilters =
    search.trim().length > 0 ||
    selectedCategoryId !== "all" ||
    selectedTags.length > 0;
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
    setIsEditorOpen(true);
  };

  const openEditModal = (prompt: Prompt) => {
    startTransition(() => {
      setSelectedPrompt(prompt);
      setFeedback(null);
    });
    setIsEditorOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    await saveMutation.mutateAsync(toPayload(formState));
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

  const selectedPromptId = selectedPrompt?.id ?? null;

  return (
    <div className="text-foreground">
      <div className="px-5 py-8 lg:px-10 lg:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,251,235,0.98),_rgba(255,255,255,0.95))] p-6 shadow-xl lg:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-950">
                Reusable Assets
              </span>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
                  Prompt Library
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600">
                  Manage reusable prompts, keep categories consistent, and archive
                  old entries without deleting benchmark history.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Visible Prompts"
                tone="amber"
                value={String(visiblePrompts.length)}
                icon={FileText}
              />
              <MetricCard
                label="Categories"
                tone="amber"
                value={String(categoryCount)}
                icon={Shapes}
              />
              <MetricCard
                label="System Packs"
                tone="amber"
                value={String(
                  (categoriesQuery.data ?? []).filter((item) => item.is_system).length,
                )}
                icon={Sparkles}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 space-y-6">
          <Card className="overflow-visible border-border/70 bg-white/90 shadow-sm">
            <div className="relative z-30 border-b border-border/80 px-5 py-4">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.88fr)_minmax(0,1.1fr)_auto] xl:items-stretch">
                  <label className="relative min-h-14 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="h-14 pl-9"
                      placeholder="Search names, descriptions, tags"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  <div className="relative z-40 min-w-0">
                    <button
                      className="flex h-14 w-full items-center justify-between rounded-2xl border border-border/80 bg-white px-4 text-left shadow-[0_12px_30px_-18px_rgba(15,23,42,0.24)] transition hover:border-amber-300 hover:bg-amber-50/60"
                      type="button"
                      onClick={() =>
                        setIsCategoryMenuOpen((current) => !current)
                      }
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Category
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {categoryLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedCategoryId !== "all" ? (
                          <Badge variant="accent">Filtered</Badge>
                        ) : null}
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Browse
                        </span>
                      </div>
                    </button>

                    {isCategoryMenuOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-3xl border border-border/80 bg-white shadow-[0_24px_64px_-24px_rgba(15,23,42,0.35)]">
                        <div className="border-b border-border/70 bg-gradient-to-b from-amber-50 to-white px-4 py-3">
                          <p className="text-sm font-semibold text-slate-950">
                            Choose a category
                          </p>
                          <p className="text-xs text-slate-500">
                            Narrow the library to one family of prompts.
                          </p>
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2">
                          <button
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition",
                              selectedCategoryId === "all"
                                ? "bg-amber-100 text-amber-950"
                                : "hover:bg-slate-50",
                            )}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId("all");
                              setIsCategoryMenuOpen(false);
                            }}
                          >
                            <span className="font-medium">All categories</span>
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
                                    ? "bg-sky-100 text-sky-950"
                                    : "hover:bg-slate-50",
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
                                    <span className="block text-xs text-slate-500">
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
                      className="flex h-14 w-full items-center justify-between rounded-2xl border border-border/80 bg-white px-4 text-left shadow-[0_12px_30px_-18px_rgba(15,23,42,0.24)] transition hover:border-amber-300 hover:bg-amber-50/60"
                      type="button"
                      onClick={() => setIsTagsMenuOpen((current) => !current)}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Tags
                        </p>
                        <div className="mt-1 flex min-h-6 flex-wrap items-center gap-2">
                          {selectedTags.length > 0 ? (
                            selectedTags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="accent">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm font-semibold text-slate-950">
                              Add or remove tags
                            </span>
                          )}
                          {selectedTags.length > 3 ? (
                            <Badge variant="neutral">
                              +{selectedTags.length - 3} more
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Manage
                        </span>
                      </div>
                    </button>

                    {isTagsMenuOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-3xl border border-border/80 bg-white shadow-[0_24px_64px_-24px_rgba(15,23,42,0.35)]">
                        <div className="border-b border-border/70 bg-gradient-to-b from-amber-50 to-white px-4 py-3">
                          <p className="text-sm font-semibold text-slate-950">
                            Manage tags
                          </p>
                          <p className="text-xs text-slate-500">
                            Add tags to refine the library, or remove them to broaden it.
                          </p>
                        </div>

                        <div className="space-y-4 p-4">
                          <div className="flex gap-2">
                            <Input
                              className="flex-1"
                              placeholder="Add a tag"
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
                              Add
                            </Button>
                          </div>

                          {selectedTags.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Active tags
                                </span>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                  onClick={() => setSelectedTags([])}
                                >
                                  Clear all
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
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Suggestions
                              </span>
                              {suggestedTags.length > 0 ? (
                                <span className="text-xs text-slate-400">
                                  Click to add
                                </span>
                              ) : null}
                            </div>
                            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
                              {suggestedTags.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {suggestedTags.map((tag) => (
                                    <button
                                      key={tag}
                                      className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900"
                                      type="button"
                                      onClick={() => addTag(tag)}
                                    >
                                      <Plus className="h-3 w-3" />
                                      {tag}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="px-2 py-3 text-sm text-slate-400">
                                  No remaining tags to suggest.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                <div className="relative z-40 flex flex-wrap items-center gap-3 xl:justify-end">
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
                          "border-amber-300 bg-amber-100 text-amber-950 shadow-[0_14px_28px_-18px_rgba(180,83,9,0.45)] hover:bg-amber-200",
                      )}
                      title={showArchived ? "Show unarchived" : "Show archived"}
                      type="button"
                      variant={showArchived ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setShowArchived((current) => !current)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button onClick={openCreateModal}>
                      <Plus className="h-4 w-4" />
                      New prompt
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
              <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
                {feedback}
              </div>
            ) : null}

            <div
              className={cn(
                "relative z-10 overflow-x-auto",
                showArchived && "border-l-4 border-amber-300 bg-amber-50/20 pl-0",
              )}
            >
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Tags</th>
                    <th className="px-5 py-3 font-semibold">Updated</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promptsQuery.isLoading ? (
                    <TableEmptyRow message="Loading prompt library..." />
                  ) : visiblePrompts.length === 0 ? (
                    <TableEmptyRow
                      message={
                        showArchived
                          ? "No archived prompts yet."
                          : promptsQuery.data?.total === 0
                          ? "Built-in prompts are seeded automatically on first load. Refresh if the library is still empty."
                          : "No prompts match the current filters."
                      }
                    />
                  ) : (
                    visiblePrompts.map((prompt) => {
                      const isSelected = prompt.id === selectedPromptId;

                      return (
                        <tr
                          key={prompt.id}
                          className={cn(
                            "cursor-pointer border-t border-border/70 transition-colors",
                            isSelected && "bg-amber-50/70",
                          )}
                        onClick={() => {
                          openEditModal(prompt);
                        }}
                      >
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-950 transition hover:text-amber-900">
                                {prompt.name}
                              </p>
                              <p className="max-w-sm text-sm text-slate-500">
                                {prompt.description ?? "No description"}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <Badge variant="accent">{prompt.category.name}</Badge>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex max-w-56 flex-wrap gap-2">
                              {prompt.tags.length > 0 ? (
                                prompt.tags.map((tag) => (
                                  <Badge key={tag} variant="neutral">
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-slate-400">No tags</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top text-sm text-slate-500">
                            {formatDate(prompt.updated_at)}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex gap-2">
                              <Badge variant={prompt.is_archived ? "muted" : "success"}>
                                {prompt.is_archived ? "Archived" : "Active"}
                              </Badge>
                              {!prompt.is_active && !prompt.is_archived ? (
                                <Badge variant="neutral">Inactive</Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top" onClick={(event) => event.stopPropagation()}>
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
        description="Create a reusable prompt or refine an existing one without leaving the library view."
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
        title={selectedPrompt ? "Edit prompt" : "Create prompt"}
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {loadError ? (
            <LoadErrorState compact message={loadError} resourceLabel="the prompt library" />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              hint='Example: "Summarize a product launch email"'
              label="Name"
            >
              <Input
                placeholder="Summarize a product launch email"
                required
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>

            <Field
              hint="Select the closest prompt family used in the library."
              label="Category"
            >
              <Select
                required
                value={formState.categoryId}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
              >
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            hint='Example: "Short benchmark brief displayed in the library."'
            label="Description"
          >
            <Textarea
              className="min-h-20"
              placeholder="Short benchmark brief displayed in the library."
              value={formState.description}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Field>

          <Field
            hint='Example: "summarization, writing, business"'
            label="Tags"
          >
            <Input
              placeholder="Comma-separated tags"
              value={formState.tags}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  tags: event.target.value,
                }))
              }
            />
          </Field>

          <Field
            hint='Example: "You are a precise analyst who writes concise answers."'
            label="System prompt"
          >
            <Textarea
              placeholder="You are a precise analyst who writes concise answers."
              value={formState.systemPromptText}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  systemPromptText: event.target.value,
                }))
              }
            />
          </Field>

          <Field
            hint='Example: "Summarize the following text in 5 clear bullet points."'
            label="User prompt"
          >
            <Textarea
              required
              className="min-h-40"
              placeholder="Summarize the following text in 5 clear bullet points."
              value={formState.userPromptText}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  userPromptText: event.target.value,
                }))
              }
            />
          </Field>

          <Field
            hint='Example: "Check factual accuracy, structure and concise tone."'
            label="Evaluation notes"
          >
            <Textarea
              placeholder="Check factual accuracy, structure and concise tone."
              value={formState.evaluationNotes}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  evaluationNotes: event.target.value,
                }))
              }
            />
          </Field>

          <label className="flex items-center gap-3 rounded-2xl border border-border/80 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              checked={formState.isActive}
              className="h-4 w-4 rounded border-border"
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              type="checkbox"
            />
            Prompt available for upcoming sessions
          </label>
          <p className="-mt-2 text-xs leading-5 text-slate-500">
            Keep this enabled when the prompt should remain selectable in future
            sessions.
          </p>

          {feedback ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {feedback}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
            {selectedPrompt ? (
              <Button
                aria-label={`Archive ${selectedPrompt.name}`}
                disabled={archiveMutation.isPending || selectedPrompt.is_archived}
                onClick={() => archiveMutation.mutate(selectedPrompt.id)}
                size="iconSm"
                title={`Archive ${selectedPrompt.name}`}
                type="button"
                variant="dangerSoft"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
            <Button onClick={() => setIsEditorOpen(false)} type="button" variant="soft">
              Cancel
            </Button>
            <Button
              disabled={
                saveMutation.isPending ||
                categoriesQuery.isLoading ||
                !formState.categoryId ||
                !formState.name.trim() ||
                !formState.userPromptText.trim()
              }
              type="submit"
            >
              {selectedPrompt ? "Save changes" : "Create prompt"}
            </Button>
          </div>
        </form>
      </Modal>
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

function Field({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="block">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint ? (
          <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}
