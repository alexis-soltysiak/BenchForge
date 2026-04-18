import type { FormEvent, ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import {
  FileText,
  PencilLine,
  Plus,
  Search,
  Shapes,
  Sparkles,
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

export function PromptLibraryPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
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
  const visiblePrompts = scopedPrompts.filter((prompt) =>
    matchesSearch(prompt, search),
  );
  const categoryCount = categoriesQuery.data?.length ?? 0;
  const loadError =
    (categoriesQuery.error instanceof ApiError && categoriesQuery.error.message) ||
    (promptsQuery.error instanceof ApiError && promptsQuery.error.message) ||
    null;

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
          <Card className="overflow-hidden border-border/70 bg-white/90 shadow-sm">
            <div className="border-b border-border/80 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    Global Prompt Library
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Browse existing prompts and switch between active and archived
                    entries.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative block min-w-64">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-9"
                      placeholder="Search prompts, tags, categories"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <Button
                    variant={showArchived ? "secondary" : "ghost"}
                    onClick={() => setShowArchived((current) => !current)}
                  >
                    {showArchived ? "Show unarchived" : "Show archived"}
                  </Button>
                  <Button onClick={openCreateModal}>
                    <Plus className="h-4 w-4" />
                    New prompt
                  </Button>
                </div>
              </div>
            </div>

            {loadError ? (
              <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-900">
                {loadError}
              </div>
            ) : null}

            {feedback ? (
              <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
                {feedback}
              </div>
            ) : null}

            <div className="overflow-x-auto">
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
                            "border-t border-border/70 transition-colors",
                            isSelected && "bg-amber-50/70",
                          )}
                        >
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-1">
                              <button
                                className="text-left text-sm font-semibold text-slate-950 transition hover:text-amber-900"
                                onClick={() => {
                                  startTransition(() => {
                                    setSelectedPrompt(prompt);
                                    setFeedback(null);
                                  });
                                }}
                                type="button"
                              >
                                {prompt.name}
                              </button>
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
                          <td className="px-5 py-4 align-top">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                aria-label={`Edit ${prompt.name}`}
                                size="iconSm"
                                title={`Edit ${prompt.name}`}
                                variant="soft"
                                onClick={() => openEditModal(prompt)}
                              >
                                <PencilLine className="h-4 w-4" />
                              </Button>
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
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {loadError}
            </div>
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
