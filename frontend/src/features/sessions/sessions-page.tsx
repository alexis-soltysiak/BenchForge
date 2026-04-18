import type { FormEvent, ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import {
  Copy,
  Layers3,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addSessionCandidate,
  addSessionJudge,
  addSessionPrompt,
  archiveSession,
  createSession,
  duplicateSession,
  fetchSessions,
  launchSessionRun,
  removeSessionCandidate,
  removeSessionJudge,
  removeSessionPrompt,
  updateSession,
} from "@/features/sessions/api";
import type { Session, SessionPayload } from "@/features/sessions/types";
import { fetchPrompts } from "@/features/prompts/api";
import { fetchModelProfiles } from "@/features/models/api";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type SessionFormState = {
  name: string;
  description: string;
  status: "draft" | "ready" | "archived";
  maxCandidates: string;
  rubricVersion: string;
};

const emptyForm: SessionFormState = {
  name: "",
  description: "",
  status: "draft",
  maxCandidates: "5",
  rubricVersion: "mvp-v1",
};

function toFormState(session: Session): SessionFormState {
  return {
    name: session.name,
    description: session.description ?? "",
    status: session.status,
    maxCandidates: String(session.max_candidates),
    rubricVersion: session.rubric_version,
  };
}

function toPayload(state: SessionFormState): SessionPayload {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    status: state.status,
    max_candidates: Number(state.maxCandidates),
    rubric_version: state.rubricVersion.trim(),
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function matchesSearch(session: Session, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    session.name,
    session.description ?? "",
    session.status,
    session.rubric_version,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function matchesArchiveState(session: Session, showArchived: boolean): boolean {
  return showArchived ? session.status === "archived" : session.status !== "archived";
}

export function SessionsPage({ onOpenRun }: { onOpenRun?: (runId: number) => void }) {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formState, setFormState] = useState<SessionFormState>(emptyForm);
  const [promptSearch, setPromptSearch] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [judgeSearch, setJudgeSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sessionsQuery = useQuery({
    queryKey: ["sessions", showArchived],
    queryFn: () => fetchSessions(showArchived),
  });
  const promptsQuery = useQuery({
    queryKey: ["prompts", "sessions-picker"],
    queryFn: () => fetchPrompts(false),
  });
  const modelsQuery = useQuery({
    queryKey: ["model-profiles", "sessions-picker"],
    queryFn: () => fetchModelProfiles(false),
  });
  useEffect(() => {
    if (selectedSession) {
      setFormState(toFormState(selectedSession));
      return;
    }

    setFormState(emptyForm);
  }, [selectedSession]);

  useEffect(() => {
    if (selectedSession && !matchesArchiveState(selectedSession, showArchived)) {
      setSelectedSession(null);
    }
  }, [selectedSession, showArchived]);

  const refreshSessions = async () => {
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: SessionPayload) => {
      if (selectedSession) {
        return updateSession(selectedSession.id, payload);
      }
      return createSession(payload);
    },
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback(
        selectedSession
          ? `Session "${session.name}" updated.`
          : `Session "${session.name}" created.`,
      );
      setIsEditorOpen(false);
      startTransition(() => {
        setSelectedSession(session);
        setFormState(toFormState(session));
      });
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to save session.");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (sessionId: number) => archiveSession(sessionId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback(`Session "${session.name}" archived.`);
      setIsEditorOpen(false);
      startTransition(() => setSelectedSession(showArchived ? session : null));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const duplicateMutation = useMutation({
    mutationFn: (sessionId: number) => duplicateSession(sessionId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback(`Session duplicated as "${session.name}".`);
      startTransition(() => setSelectedSession(session));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const addPromptMutation = useMutation({
    mutationFn: ({ sessionId, promptId }: { sessionId: number; promptId: number }) =>
      addSessionPrompt(sessionId, promptId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback("Prompt added to session.");
      startTransition(() => setSelectedSession(session));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const removePromptMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeSessionPrompt(sessionId, itemId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback("Prompt removed from session.");
      startTransition(() => setSelectedSession(session));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const addCandidateMutation = useMutation({
    mutationFn: ({ sessionId, modelId }: { sessionId: number; modelId: number }) =>
      addSessionCandidate(sessionId, modelId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback("Candidate added to session.");
      startTransition(() => setSelectedSession(session));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const removeCandidateMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeSessionCandidate(sessionId, itemId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback("Candidate removed from session.");
      startTransition(() => setSelectedSession(session));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const addJudgeMutation = useMutation({
    mutationFn: ({ sessionId, modelId }: { sessionId: number; modelId: number }) =>
      addSessionJudge(sessionId, modelId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback("Judge added to session.");
      startTransition(() => setSelectedSession(session));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const launchMutation = useMutation({
    mutationFn: (sessionId: number) => launchSessionRun(sessionId),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: ["runs"] });
      setFeedback(`Run "${run.name}" launched.`);
      onOpenRun?.(run.id);
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to launch run.");
    },
  });
  const removeJudgeMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeSessionJudge(sessionId, itemId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback("Judge removed from session.");
      startTransition(() => setSelectedSession(session));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });

  const scopedSessions = (sessionsQuery.data?.items ?? []).filter((session) =>
    matchesArchiveState(session, showArchived),
  );
  const visibleSessions = scopedSessions.filter((session) =>
    matchesSearch(session, search),
  );
  const availablePrompts = (promptsQuery.data?.items ?? []).filter((prompt) => {
    const notSelected = !selectedSession?.prompts.some((item) => item.prompt_id === prompt.id);
    const matches =
      !promptSearch ||
      [prompt.name, prompt.category.name, prompt.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(promptSearch.toLowerCase());
    return notSelected && matches;
  });
  const availableCandidates = (modelsQuery.data?.items ?? []).filter((model) => {
    const allowed = model.role === "candidate" || model.role === "both";
    const notSelected = !selectedSession?.candidates.some(
      (item) => item.model_profile_id === model.id,
    );
    const matches =
      !candidateSearch ||
      [model.display_name, model.provider_type, model.runtime_type]
        .join(" ")
        .toLowerCase()
        .includes(candidateSearch.toLowerCase());
    return allowed && notSelected && matches;
  });
  const availableJudges = (modelsQuery.data?.items ?? []).filter((model) => {
    const allowed = model.role === "judge" || model.role === "both";
    const notSelected = !selectedSession?.judges.some(
      (item) => item.model_profile_id === model.id,
    );
    const matches =
      !judgeSearch ||
      [model.display_name, model.provider_type, model.runtime_type]
        .join(" ")
        .toLowerCase()
        .includes(judgeSearch.toLowerCase());
    return allowed && notSelected && matches;
  });

  const openCreateModal = () => {
    startTransition(() => {
      setSelectedSession(null);
      setFormState(emptyForm);
      setFeedback(null);
    });
    setIsEditorOpen(true);
  };

  const openEditModal = (session: Session) => {
    startTransition(() => {
      setSelectedSession(session);
      setFeedback(null);
    });
    setIsEditorOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    await saveMutation.mutateAsync(toPayload(formState));
  };

  const selectedSessionId = selectedSession?.id;
  const loadError =
    (sessionsQuery.error instanceof ApiError && sessionsQuery.error.message) ||
    (promptsQuery.error instanceof ApiError && promptsQuery.error.message) ||
    (modelsQuery.error instanceof ApiError && modelsQuery.error.message) ||
    null;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10 xl:ml-auto xl:mr-0">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(255,255,255,0.96))] p-6 shadow-xl lg:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-950">
              Benchmark Setup
            </span>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
                Sessions
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Assemble prompts, candidate models, and a judge into reusable benchmark
                sessions ready for launch.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              icon={Layers3}
              label="Visible Sessions"
              tone="emerald"
              value={String(visibleSessions.length)}
            />
            <MetricCard
              icon={Users}
              label="Prompt Library"
              tone="emerald"
              value={String(promptsQuery.data?.total ?? 0)}
            />
            <MetricCard
              icon={ShieldCheck}
              label="Model Registry"
              tone="emerald"
              value={String(modelsQuery.data?.total ?? 0)}
            />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.5fr]">
        <Card className="overflow-hidden border-border/70 bg-white/90 shadow-sm">
          <div className="border-b border-border/80 px-5 py-4">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Sessions List</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Browse and manage benchmark session definitions.
                </p>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search sessions"
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
                New session
              </Button>
              <Button
                aria-label={
                  selectedSession ? `Edit ${selectedSession.name}` : "Edit session"
                }
                disabled={!selectedSession}
                onClick={() => selectedSession && openEditModal(selectedSession)}
                size="iconSm"
                title={selectedSession ? `Edit ${selectedSession.name}` : "Edit session"}
                variant="soft"
              >
                <PencilLine className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border/70">
            {sessionsQuery.isLoading ? (
              <div className="px-5 py-12 text-sm text-slate-500">Loading sessions...</div>
            ) : visibleSessions.length === 0 ? (
              <div className="px-5 py-12 text-sm text-slate-500">
                {showArchived
                  ? "No archived sessions yet."
                  : "No sessions found. Create a benchmark session with seeded prompts and registered models to launch your first run."}
              </div>
            ) : (
              visibleSessions.map((session) => (
                <button
                  key={session.id}
                  className={cn(
                    "block w-full px-5 py-4 text-left transition hover:bg-emerald-50/70",
                    selectedSessionId === session.id && "bg-emerald-50",
                  )}
                  onClick={() => {
                    startTransition(() => {
                      setSelectedSession(session);
                      setFeedback(null);
                    });
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{session.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {session.description ?? "No description"}
                      </p>
                    </div>
                    <Badge variant={session.status === "archived" ? "muted" : "success"}>
                      {session.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{session.prompts.length} prompts</span>
                    <span>{session.candidates.length} candidates</span>
                    <span>{session.judges.length} judges</span>
                    <span>Updated {formatDate(session.updated_at)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    Session Overview
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {selectedSession ? selectedSession.name : "Select a session"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {selectedSession
                      ? "Manage the selected session from here, then curate prompts and models below."
                      : "Select a session from the list to manage prompts, candidates, judges, and launches."}
                  </p>
                </div>
                <Badge variant={selectedSession ? "accent" : "neutral"}>
                  {selectedSession ? "Selected" : "Ready"}
                </Badge>
              </div>

              <div className="rounded-[1.5rem] border border-border/80 bg-slate-50/80 p-4">
                {selectedSession ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">
                          {selectedSession.name}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {selectedSession.description ?? "No description provided."}
                        </p>
                      </div>
                      <Badge
                        variant={
                          selectedSession.status === "archived" ? "muted" : "success"
                        }
                      >
                        {selectedSession.status}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard
                        className="bg-white"
                        icon={Layers3}
                        label="Prompts"
                        tone="emerald"
                        value={String(selectedSession.prompts.length)}
                      />
                      <MetricCard
                        className="bg-white"
                        icon={Users}
                        label="Candidates"
                        tone="emerald"
                        value={String(selectedSession.candidates.length)}
                      />
                      <MetricCard
                        className="bg-white"
                        icon={ShieldCheck}
                        label="Judges"
                        tone="emerald"
                        value={String(selectedSession.judges.length)}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    Pick a session from the list to review its status and launch
                    benchmark runs.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {selectedSession ? (
                  <Button
                    disabled={launchMutation.isPending}
                    onClick={() => launchMutation.mutate(selectedSession.id)}
                  >
                    Launch benchmark
                  </Button>
                ) : null}
                {selectedSession ? (
                  <Button
                    disabled={duplicateMutation.isPending}
                    onClick={() => duplicateMutation.mutate(selectedSession.id)}
                    variant="secondary"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </Button>
                ) : null}
                {selectedSession ? (
                  <Button
                    aria-label={`Archive ${selectedSession.name}`}
                    disabled={
                      archiveMutation.isPending || selectedSession.status === "archived"
                    }
                    onClick={() => archiveMutation.mutate(selectedSession.id)}
                    size="iconSm"
                    title={`Archive ${selectedSession.name}`}
                    variant="dangerSoft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              {loadError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {loadError}
                </div>
              ) : null}

              {feedback ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                  {feedback}
                </div>
              ) : null}

              {(isPending ||
                saveMutation.isPending ||
                archiveMutation.isPending ||
                duplicateMutation.isPending) && (
                <p className="text-sm text-slate-500">Syncing changes...</p>
              )}
              {launchMutation.isPending && (
                <p className="text-sm text-slate-500">Launching run...</p>
              )}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <SelectionPanel
              description="Select prompts from the global library."
              emptyMessage="Create a session to start selecting prompts."
              search={promptSearch}
              selectedItems={selectedSession?.prompts.length ?? 0}
              title="Prompt Selection"
              onSearchChange={setPromptSearch}
            >
              {selectedSession ? (
                <>
                  <SelectedList
                    items={selectedSession.prompts.map((item) => ({
                      id: item.id,
                      label: item.prompt_name,
                      meta: `Order ${item.display_order}`,
                    }))}
                    onRemove={(itemId) =>
                      removePromptMutation.mutate({
                        sessionId: selectedSession.id,
                        itemId,
                      })
                    }
                  />
                  <LibraryList
                    items={availablePrompts.map((prompt) => ({
                      id: prompt.id,
                      label: prompt.name,
                      meta: prompt.category.name,
                    }))}
                    onAdd={(promptId) =>
                      addPromptMutation.mutate({
                        sessionId: selectedSession.id,
                        promptId,
                      })
                    }
                  />
                </>
              ) : null}
            </SelectionPanel>

            <SelectionPanel
              description="Attach up to 5 candidate models for MVP."
              emptyMessage="Create a session to start selecting candidates."
              search={candidateSearch}
              selectedItems={selectedSession?.candidates.length ?? 0}
              title="Candidate Selection"
              onSearchChange={setCandidateSearch}
            >
              {selectedSession ? (
                <>
                  <SelectedList
                    items={selectedSession.candidates.map((item) => ({
                      id: item.id,
                      label: item.display_name,
                      meta: `${item.provider_type} / ${item.runtime_type}`,
                    }))}
                    onRemove={(itemId) =>
                      removeCandidateMutation.mutate({
                        sessionId: selectedSession.id,
                        itemId,
                      })
                    }
                  />
                  <LibraryList
                    items={availableCandidates.map((model) => ({
                      id: model.id,
                      label: model.display_name,
                      meta: `${model.provider_type} / ${model.runtime_type}`,
                    }))}
                    onAdd={(modelId) =>
                      addCandidateMutation.mutate({
                        sessionId: selectedSession.id,
                        modelId,
                      })
                    }
                  />
                </>
              ) : null}
            </SelectionPanel>

            <SelectionPanel
              description="Choose exactly one judge model for MVP."
              emptyMessage="Create a session to choose a judge."
              search={judgeSearch}
              selectedItems={selectedSession?.judges.length ?? 0}
              title="Judge Selection"
              onSearchChange={setJudgeSearch}
            >
              {selectedSession ? (
                <>
                  <SelectedList
                    items={selectedSession.judges.map((item) => ({
                      id: item.id,
                      label: item.display_name,
                      meta: `${item.provider_type} / ${item.runtime_type}`,
                    }))}
                    onRemove={(itemId) =>
                      removeJudgeMutation.mutate({
                        sessionId: selectedSession.id,
                        itemId,
                      })
                    }
                  />
                  <LibraryList
                    items={availableJudges.map((model) => ({
                      id: model.id,
                      label: model.display_name,
                      meta: `${model.provider_type} / ${model.runtime_type}`,
                    }))}
                    onAdd={(modelId) =>
                      addJudgeMutation.mutate({
                        sessionId: selectedSession.id,
                        modelId,
                      })
                    }
                  />
                </>
              ) : null}
            </SelectionPanel>
          </div>
        </div>
      </section>

      <Modal
        description="Create a benchmark session or update the selected one without leaving the setup screen."
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
        title={selectedSession ? "Edit session" : "Create session"}
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {loadError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {loadError}
            </div>
          ) : null}

          <Field
            hint='Example: "Release Notes Benchmark - April"'
            label="Name"
          >
            <Input
              placeholder="Release Notes Benchmark - April"
              required
              value={formState.name}
              onChange={(event) =>
                setFormState((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>

          <Field
            hint='Example: "Compare three models on product update summarization."'
            label="Description"
          >
            <Textarea
              className="min-h-24"
              placeholder="Compare three models on product update summarization."
              value={formState.description}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              hint="Use Draft while configuring, then Ready when the session can be launched."
              label="Status"
            >
              <Select
                value={formState.status}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as SessionFormState["status"],
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field
              hint="Choose how many candidate model slots this session can accept."
              label="Max candidates"
            >
              <Select
                value={formState.maxCandidates}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    maxCandidates: event.target.value,
                  }))
                }
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </Select>
            </Field>
            <Field
              hint='Example: "mvp-v1"'
              label="Rubric version"
            >
              <Input
                placeholder="mvp-v1"
                value={formState.rubricVersion}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    rubricVersion: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          {feedback ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              {feedback}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
            {selectedSession ? (
              <Button
                aria-label={`Archive ${selectedSession.name}`}
                disabled={archiveMutation.isPending || selectedSession.status === "archived"}
                onClick={() => archiveMutation.mutate(selectedSession.id)}
                size="iconSm"
                title={`Archive ${selectedSession.name}`}
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
              disabled={!formState.name.trim() || saveMutation.isPending}
              type="submit"
            >
              {selectedSession ? "Save session" : "Create session"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SelectionPanel({
  children,
  description,
  emptyMessage,
  search,
  selectedItems,
  title,
  onSearchChange,
}: {
  children: ReactNode;
  description: string;
  emptyMessage: string;
  search: string;
  selectedItems: number;
  title: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
      <div className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            {selectedItems} selected
          </h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search library"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        {children ?? <p className="text-sm text-slate-500">{emptyMessage}</p>}
      </div>
    </Card>
  );
}

function SelectedList({
  items,
  onRemove,
}: {
  items: Array<{ id: number; label: string; meta: string }>;
  onRemove: (itemId: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Selected
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing selected yet.</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-slate-50 px-3 py-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-950">{item.label}</p>
              <p className="text-xs text-slate-500">{item.meta}</p>
            </div>
            <Button size="sm" variant="dangerSoft" onClick={() => onRemove(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

function LibraryList({
  items,
  onAdd,
}: {
  items: Array<{ id: number; label: string; meta: string }>;
  onAdd: (itemId: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Library
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No matching items available.</p>
      ) : (
        items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-white px-3 py-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-950">{item.label}</p>
              <p className="text-xs text-slate-500">{item.meta}</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => onAdd(item.id)}>
              Add
            </Button>
          </div>
        ))
      )}
    </div>
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
