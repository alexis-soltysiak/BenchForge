import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  BadgeInfo,
  Copy,
  Layers3,
  PencilLine,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
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
import type {
  Session,
  SessionListResponse,
  SessionPayload,
} from "@/features/sessions/types";
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

type SessionSelectionStep = "prompts" | "candidates" | "judges";

export function SessionsPage({ onOpenRun }: { onOpenRun?: (runId: number) => void }) {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const [selectionStep, setSelectionStep] = useState<SessionSelectionStep>("prompts");
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

  useEffect(() => {
    if (!selectedSession || !sessionsQuery.data) {
      return;
    }

    const freshSession = sessionsQuery.data.items.find(
      (session) => session.id === selectedSession.id,
    );

    if (!freshSession) {
      return;
    }

    if (freshSession !== selectedSession) {
      setSelectedSession(freshSession);
    }
  }, [selectedSession, sessionsQuery.data]);

  const refreshSessions = async () => {
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const syncSessionState = (session: Session) => {
    queryClient.setQueriesData(
      { queryKey: ["sessions"] },
      (current: SessionListResponse | undefined) => {
        if (!current) {
          return current;
        }

        const existingIndex = current.items.findIndex((item) => item.id === session.id);
        if (existingIndex === -1) {
          return current;
        }

        const nextItems = [...current.items];
        nextItems[existingIndex] = session;
        return { ...current, items: nextItems };
      },
    );
    setSelectedSession(session);
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
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback("Prompt added to session.");
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const removePromptMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeSessionPrompt(sessionId, itemId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback("Prompt removed from session.");
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const addCandidateMutation = useMutation({
    mutationFn: ({ sessionId, modelId }: { sessionId: number; modelId: number }) =>
      addSessionCandidate(sessionId, modelId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback("Candidate added to session.");
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const removeCandidateMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeSessionCandidate(sessionId, itemId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback("Candidate removed from session.");
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Operation failed.");
    },
  });
  const addJudgeMutation = useMutation({
    mutationFn: ({ sessionId, modelId }: { sessionId: number; modelId: number }) =>
      addSessionJudge(sessionId, modelId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback("Judge added to session.");
      void refreshSessions();
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
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback("Judge removed from session.");
      void refreshSessions();
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

  const openSelectionModal = (
    session: Session,
    step: SessionSelectionStep = "prompts",
  ) => {
    startTransition(() => {
      setSelectedSession(session);
      setSelectionStep(step);
      setFeedback(null);
    });
    setIsSelectionOpen(true);
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
  const retryLoad = () => {
    void Promise.all([
      sessionsQuery.refetch(),
      promptsQuery.refetch(),
      modelsQuery.refetch(),
    ]);
  };

  return (
    <div className="px-5 py-8 lg:px-10 lg:py-10">
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

      <section className="mt-8 space-y-6">
        <Card className="border-border/70 bg-white/90 shadow-sm">
          <div className="border-b border-border/80 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Sessions List</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Browse and manage benchmark session definitions.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <label className="relative block min-w-64">
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
                <Button
                  disabled={!selectedSession}
                  onClick={() =>
                    selectedSession && openSelectionModal(selectedSession, "prompts")
                  }
                  variant="secondary"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Configure selection
                </Button>
                <Button onClick={openCreateModal}>
                  <Plus className="h-4 w-4" />
                  New session
                </Button>
              </div>
            </div>
          </div>

          {loadError ? (
            <LoadErrorState
              message={loadError}
              onRetry={retryLoad}
              resourceLabel="sessions"
            />
          ) : null}

          {feedback ? (
            <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-950">
              {feedback}
            </div>
          ) : null}

          {(isPending ||
            saveMutation.isPending ||
            archiveMutation.isPending ||
            duplicateMutation.isPending) && (
            <div className="border-b border-border/70 px-5 py-3 text-sm text-slate-500">
              Syncing changes...
            </div>
          )}
          {launchMutation.isPending && (
            <div className="border-b border-border/70 px-5 py-3 text-sm text-slate-500">
              Launching run...
            </div>
          )}

          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Session</th>
                  <th className="px-5 py-3 font-semibold">Composition</th>
                  <th className="px-5 py-3 font-semibold">Rubric</th>
                  <th className="px-5 py-3 font-semibold">Updated</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessionsQuery.isLoading ? (
                  <TableEmptyRow message="Loading sessions..." />
                ) : visibleSessions.length === 0 ? (
                  <TableEmptyRow
                    message={
                      showArchived
                        ? "No archived sessions yet."
                        : "No sessions found. Create a benchmark session with seeded prompts and registered models to launch your first run."
                    }
                  />
                ) : (
                  visibleSessions.map((session) => {
                    const isSelected = selectedSessionId === session.id;

                    return (
                      <tr
                        key={session.id}
                        className={cn(
                          "cursor-pointer border-t border-border/70 transition-colors",
                          isSelected && "bg-emerald-50/60",
                        )}
                        onClick={() => {
                          startTransition(() => {
                            setSelectedSession(session);
                            setFeedback(null);
                          });
                        }}
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-950 transition hover:text-emerald-800">
                              {session.name}
                            </p>
                            <p className="max-w-sm text-sm text-slate-500">
                              {session.description ?? "No description"}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="neutral">{session.prompts.length} prompts</Badge>
                            <Badge variant="neutral">
                              {session.candidates.length}/{session.max_candidates} candidates
                            </Badge>
                            <Badge variant="neutral">{session.judges.length} judges</Badge>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">
                          {session.rubric_version}
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-slate-500">
                          {formatDate(session.updated_at)}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Badge
                            variant={session.status === "archived" ? "muted" : "success"}
                          >
                            {session.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 align-top" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <ActionIconButton
                              aria-label={`Configure ${session.name}`}
                              description="Open the step-by-step selection flow for prompts, candidates, and judge."
                              label="Configure"
                              onClick={() => openSelectionModal(session, "prompts")}
                              size="iconSm"
                              variant="soft"
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton
                              aria-label={`Edit ${session.name}`}
                              description="Edit the session name, description, status, candidate limit, and rubric version."
                              label="Edit"
                              onClick={() => openEditModal(session)}
                              size="iconSm"
                              variant="soft"
                            >
                              <PencilLine className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton
                              aria-label={`Launch ${session.name}`}
                              description="Create and start a new benchmark run from this session configuration."
                              disabled={launchMutation.isPending}
                              label="Launch"
                              onClick={() => launchMutation.mutate(session.id)}
                              size="iconSm"
                              variant="secondary"
                            >
                              <Rocket className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton
                              aria-label={`Duplicate ${session.name}`}
                              description="Clone this session with its current prompts, candidates, and judge selections."
                              disabled={duplicateMutation.isPending}
                              label="Duplicate"
                              onClick={() => duplicateMutation.mutate(session.id)}
                              size="iconSm"
                              variant="secondary"
                            >
                              <Copy className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton
                              aria-label={`Archive ${session.name}`}
                              description="Archive this session so it disappears from the active list without deleting history."
                              disabled={
                                archiveMutation.isPending || session.status === "archived"
                              }
                              label="Archive"
                              onClick={() => archiveMutation.mutate(session.id)}
                              size="iconSm"
                              variant="dangerSoft"
                            >
                              <Trash2 className="h-4 w-4" />
                            </ActionIconButton>
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

      <Modal
        description="Create a benchmark session or update the selected one without leaving the setup screen."
        onClose={() => setIsEditorOpen(false)}
        open={isEditorOpen}
        size="xxl"
        tone="emerald"
        title={selectedSession ? "Edit session" : "Create session"}
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {loadError ? (
            <LoadErrorState compact message={loadError} resourceLabel="sessions" />
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

      <Modal
        onClose={() => setIsSelectionOpen(false)}
        open={isSelectionOpen}
        size="xl"
        tone="emerald"
        title={selectedSession ? `Configure ${selectedSession.name}` : "Configure session"}
      >
        {selectedSession ? (
          <div className="space-y-4">
            <SessionStepSwitcher
              activeStep={selectionStep}
              onStepChange={setSelectionStep}
              session={selectedSession}
            />

            {selectionStep === "prompts" ? (
              <SelectionWorkspace
                description="Choose the prompts included in this benchmark session."
                search={promptSearch}
                selectedCount={selectedSession.prompts.length}
                title="Prompts"
                onSearchChange={setPromptSearch}
              >
                <SelectedList
                  emptyMessage="No prompts selected yet."
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
              </SelectionWorkspace>
            ) : null}

            {selectionStep === "candidates" ? (
              <SelectionWorkspace
                description={`Attach up to ${selectedSession.max_candidates} candidate models for this run configuration.`}
                search={candidateSearch}
                selectedCount={selectedSession.candidates.length}
                title="Candidates"
                onSearchChange={setCandidateSearch}
              >
                <SelectedList
                  emptyMessage="No candidate models selected yet."
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
              </SelectionWorkspace>
            ) : null}

            {selectionStep === "judges" ? (
              <SelectionWorkspace
                description="Assign the judge model responsible for evaluation."
                search={judgeSearch}
                selectedCount={selectedSession.judges.length}
                title="Judge"
                onSearchChange={setJudgeSearch}
              >
                <SelectedList
                  emptyMessage="No judge selected yet."
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
              </SelectionWorkspace>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
              <Button onClick={() => setIsSelectionOpen(false)} type="button" variant="soft">
                Close
              </Button>
              {selectionStep !== "judges" ? (
                <Button
                  onClick={() =>
                    setSelectionStep(
                      selectionStep === "prompts" ? "candidates" : "judges",
                    )
                  }
                  type="button"
                  variant="secondary"
                >
                  Next step
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
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

function SelectedList({
  emptyMessage,
  items,
  onRemove,
}: {
  emptyMessage?: string;
  items: Array<{ id: number; label: string; meta: string }>;
  onRemove: (itemId: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Selected
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyMessage ?? "Nothing selected yet."}</p>
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

function ActionIconButton({
  children,
  description,
  label,
  ...props
}: ComponentProps<typeof Button> & {
  children: ReactNode;
  description: string;
  label: string;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setPosition({
        left: rect.left + rect.width / 2,
        top: rect.top - 18,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  return (
    <div
      ref={triggerRef}
      className="relative"
      onBlur={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Button {...props}>{children}</Button>
      {isOpen
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[250] w-64 -translate-x-1/2 -translate-y-full"
              style={{ left: position.left, top: position.top }}
            >
              <div className="relative rounded-2xl border border-slate-200 bg-white/98 p-3 text-left shadow-[0_24px_60px_-22px_rgba(15,23,42,0.45)] ring-1 ring-slate-950/5 backdrop-blur-sm">
                <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white/98" />
                <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-[linear-gradient(135deg,_rgba(248,250,252,0.96),_rgba(255,255,255,1))] p-3">
                  <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-emerald-400" />
                  <div className="flex items-start gap-3 pl-2">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shadow-sm">
                      <BadgeInfo className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SessionStepSwitcher({
  activeStep,
  onStepChange,
  session,
}: {
  activeStep: SessionSelectionStep;
  onStepChange: (step: SessionSelectionStep) => void;
  session: Session;
}) {
  const steps = [
    {
      key: "prompts" as const,
      count: session.prompts.length,
      icon: Layers3,
      label: "Prompts",
      activeClassName:
        "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm",
      idleClassName:
        "border-border/80 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/60",
      iconClassName: "bg-emerald-100 text-emerald-900",
      badgeVariant: "success" as const,
    },
    {
      key: "candidates" as const,
      count: session.candidates.length,
      icon: Users,
      label: "Candidates",
      activeClassName:
        "border-sky-300 bg-sky-50 text-sky-950 shadow-sm",
      idleClassName:
        "border-border/80 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/60",
      iconClassName: "bg-sky-100 text-sky-900",
      badgeVariant: "neutral" as const,
    },
    {
      key: "judges" as const,
      count: session.judges.length,
      icon: ShieldCheck,
      label: "Judge",
      activeClassName:
        "border-amber-300 bg-amber-50 text-amber-950 shadow-sm",
      idleClassName:
        "border-border/80 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/60",
      iconClassName: "bg-amber-100 text-amber-900",
      badgeVariant: "success" as const,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step) => {
        const Icon = step.icon;
        const isActive = step.key === activeStep;

        return (
          <button
            key={step.key}
            className={cn(
              "rounded-[1.5rem] border px-4 py-4 text-left transition",
              isActive ? step.activeClassName : step.idleClassName,
            )}
            onClick={() => onStepChange(step.key)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <span
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm",
                    step.iconClassName,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.label}</p>
                  <p className="text-xs text-slate-500">{step.count} selected</p>
                </div>
              </div>
              <Badge variant={isActive ? step.badgeVariant : "neutral"}>
                {isActive ? "Current" : "Open"}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SelectionWorkspace({
  children,
  description,
  search,
  selectedCount,
  title,
  onSearchChange,
}: {
  children: ReactNode;
  description: string;
  search: string;
  selectedCount: number;
  title: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-border/80 bg-white p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {selectedCount} selected
          </h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <label className="relative block min-w-full lg:min-w-80">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder={`Search ${title.toLowerCase()} library`}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {children}
      </div>
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
    <label className="flex h-full flex-col gap-2">
      <span className="block min-h-[4.75rem]">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint ? (
          <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>
        ) : null}
      </span>
      <span className="block">{children}</span>
    </label>
  );
}
