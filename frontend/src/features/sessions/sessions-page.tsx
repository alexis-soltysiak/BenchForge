import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  Layers3,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addSessionCandidate,
  addSessionJudge,
  addSessionPrompt,
  archiveSession,
  createSession,
  fetchSessions,
  launchSessionRun,
  removeSessionCandidate,
  removeSessionJudge,
  removeSessionPrompt,
  updateSession,
  updateSessionPromptSamplingMode,
} from "@/features/sessions/api";
import type {
  Session,
  SessionFormState,
  SessionListResponse,
  SessionPayload,
  SessionSelectionStep,
} from "@/features/sessions/types";
import { fetchPrompts } from "@/features/prompts/api";
import { fetchModelProfiles } from "@/features/models/api";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { emptyForm } from "./constants";
import { toFormState, toPayload, formatDate, matchesSearch, matchesArchiveState } from "./utils";
import { AnimatedRocket } from "./components/animated-rocket";
import { TableEmptyRow } from "./components/table-empty-row";
import { ActionIconButton } from "./components/action-icon-button";
import { SessionStepSwitcher } from "./components/session-step-switcher";
import { Field } from "./components/field";
import { SelectionWorkspace } from "./components/selection-workspace";
import { SelectedList } from "./components/selected-list";
import { LibraryList } from "./components/library-list";
import { PromptFilters } from "./components/prompt-filters";

export function SessionsPage({ onOpenRun }: { onOpenRun?: (runId: number) => void }) {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectionStep, setSelectionStep] = useState<SessionSelectionStep>("information");
  const [formState, setFormState] = useState<SessionFormState>(emptyForm);
  const [promptSearch, setPromptSearch] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [judgeSearch, setJudgeSearch] = useState("");
  const [promptCategoryFilter, setPromptCategoryFilter] = useState<string[]>([]);
  const [promptDifficultyFilter, setPromptDifficultyFilter] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusPickerSessionId, setStatusPickerSessionId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDirtyRef = useRef(false);
  const skipFormResetRef = useRef(false);

  useEffect(() => {
    if (statusPickerSessionId === null) return;
    const handler = () => setStatusPickerSessionId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [statusPickerSessionId]);

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
    if (skipFormResetRef.current) {
      skipFormResetRef.current = false;
      isDirtyRef.current = false;
      return;
    }
    isDirtyRef.current = false;

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
      skipFormResetRef.current = true;
      startTransition(() => {
        setSelectedSession(session);
      });
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorSave"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (sessionId: number) => archiveSession(sessionId),
    onSuccess: async (session) => {
      await refreshSessions();
      setFeedback(t("sessions.feedback.archived", { name: session.name }));
      setIsModalOpen(false);
      startTransition(() => setSelectedSession(showArchived ? session : null));
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorOp"));
    },
  });
  const updateStatusMutation = useMutation({
    mutationFn: ({ session, status }: { session: Session; status: SessionFormState["status"] }) =>
      updateSession(session.id, { ...toPayload(toFormState(session)), status }),
    onSuccess: async () => {
      await refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorOp"));
    },
  });

  const addPromptMutation = useMutation({
    mutationFn: ({ sessionId, promptId }: { sessionId: number; promptId: number }) =>
      addSessionPrompt(sessionId, promptId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback(t("sessions.feedback.promptAdded"));
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorOp"));
    },
  });
  const removePromptMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeSessionPrompt(sessionId, itemId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback(t("sessions.feedback.promptRemoved"));
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorOp"));
    },
  });
  const updateSamplingModeMutation = useMutation({
    mutationFn: ({ sessionId, itemId, mode }: { sessionId: number; itemId: number; mode: string }) =>
      updateSessionPromptSamplingMode(sessionId, itemId, mode),
    onSuccess: (session) => {
      syncSessionState(session);
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorOp"));
    },
  });
  const addCandidateMutation = useMutation({
    mutationFn: ({ sessionId, modelId }: { sessionId: number; modelId: number }) =>
      addSessionCandidate(sessionId, modelId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback(t("sessions.feedback.candidateAdded"));
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorOp"));
    },
  });
  const removeCandidateMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeSessionCandidate(sessionId, itemId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback(t("sessions.feedback.candidateRemoved"));
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorOp"));
    },
  });
  const addJudgeMutation = useMutation({
    mutationFn: ({ sessionId, modelId }: { sessionId: number; modelId: number }) =>
      addSessionJudge(sessionId, modelId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback(t("sessions.feedback.judgeAdded"));
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
      setFeedback(t("sessions.feedback.runLaunched", { name: run.name }));
      onOpenRun?.(run.id);
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorLaunch"));
    },
  });
  const removeJudgeMutation = useMutation({
    mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) =>
      removeSessionJudge(sessionId, itemId),
    onSuccess: (session) => {
      syncSessionState(session);
      setFeedback(t("sessions.feedback.judgeRemoved"));
      void refreshSessions();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : t("sessions.feedback.errorOp"));
    },
  });

  useEffect(() => {
    if (!isDirtyRef.current) return;
    if (!formState.name.trim()) return;

    const timer = setTimeout(() => {
      void saveMutation.mutateAsync(toPayload(formState));
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState]);

  const scopedSessions = (sessionsQuery.data?.items ?? []).filter((session) =>
    matchesArchiveState(session, showArchived),
  );
  const visibleSessions = scopedSessions.filter((session) =>
    matchesSearch(session, search),
  );

  const allPromptCategories = useMemo(() => {
    const cats = new Map<string, string>();
    for (const p of promptsQuery.data?.items ?? []) {
      cats.set(p.category.slug, p.category.name);
    }
    return Array.from(cats.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [promptsQuery.data]);

  const allPromptDifficulties = useMemo(() => {
    const diffs = new Set<number>();
    for (const p of promptsQuery.data?.items ?? []) {
      if (p.difficulty != null) diffs.add(p.difficulty);
    }
    return Array.from(diffs).sort((a, b) => a - b);
  }, [promptsQuery.data]);

  const availablePrompts = (promptsQuery.data?.items ?? []).filter((prompt) => {
    const notSelected = !selectedSession?.prompts.some((item) => item.prompt_id === prompt.id);
    const matches =
      !promptSearch ||
      [prompt.name, prompt.category.name, prompt.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(promptSearch.toLowerCase());
    const matchesCategory =
      promptCategoryFilter.length === 0 || promptCategoryFilter.includes(prompt.category.slug);
    const matchesDifficulty =
      promptDifficultyFilter.length === 0 ||
      (prompt.difficulty != null && promptDifficultyFilter.includes(prompt.difficulty));
    return notSelected && matches && matchesCategory && matchesDifficulty;
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
      setSelectionStep("information");
      setPromptCategoryFilter([]);
      setPromptDifficultyFilter([]);
    });
    setIsModalOpen(true);
  };

  const openModal = (session: Session, step: SessionSelectionStep = "information") => {
    startTransition(() => {
      setSelectedSession(session);
      setSelectionStep(step);
      setFeedback(null);
      setPromptCategoryFilter([]);
      setPromptDifficultyFilter([]);
    });
    setIsModalOpen(true);
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
  const hasAnyFilters = Boolean(search.trim()) || showArchived;

  return (
    <div className="text-foreground">
      <header className="border-b border-border/50 px-6 pb-6 pt-8 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.28em] text-primary/80">
              {t("sessions.benchmarkSetup")}
            </p>
            <h1 className="text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
              {t("sessions.pageTitle")}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Layers3 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{visibleSessions.length}</span>{" "}
                  {t("sessions.metricVisible").toLowerCase()}
                </span>
              </div>
              <span className="mx-1.5 text-border/60">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{promptsQuery.data?.total ?? 0}</span>{" "}
                  {t("sessions.metricPromptLibrary").toLowerCase()}
                </span>
              </div>
              <span className="mx-1.5 text-border/60">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{modelsQuery.data?.total ?? 0}</span>{" "}
                  {t("sessions.metricModelRegistry").toLowerCase()}
                </span>
              </div>
            </div>
          </div>
          <Button className="shrink-0" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            {t("sessions.newSession")}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-6 py-3 lg:px-8">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 w-52 rounded-lg pl-8 text-sm"
            placeholder={t("sessions.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Reset filters"
            aria-label="Reset filters"
            disabled={!hasAnyFilters}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
              hasAnyFilters
                ? "text-muted-foreground hover:bg-[hsl(var(--surface-muted))] hover:text-foreground"
                : "cursor-default text-muted-foreground/25",
            )}
            onClick={() => {
              setSearch("");
              setShowArchived(false);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={showArchived ? t("sessions.showUnarchived") : t("sessions.showArchived")}
            aria-label={showArchived ? t("sessions.showUnarchived") : t("sessions.showArchived")}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
              showArchived
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-[hsl(var(--surface-muted))] hover:text-foreground",
            )}
            onClick={() => setShowArchived((current) => !current)}
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loadError ? (
        <LoadErrorState
          message={loadError}
          onRetry={retryLoad}
          resourceLabel={t("sessions.pageTitle")}
        />
      ) : null}

      {feedback ? (
        <div className="border-b border-primary/20 bg-primary/5 px-6 py-2.5 text-[0.82rem] text-primary lg:px-8">
          {feedback}
        </div>
      ) : null}

      {(isPending || saveMutation.isPending || archiveMutation.isPending) ? (
        <div className="border-b border-border/40 px-6 py-2.5 text-[0.82rem] text-muted-foreground lg:px-8">
          {t("sessions.syncing")}
        </div>
      ) : null}
      {launchMutation.isPending ? (
        <div className="border-b border-border/40 px-6 py-2.5 text-[0.82rem] text-muted-foreground lg:px-8">
          {t("sessions.launching")}
        </div>
      ) : null}

      <div className={cn(showArchived && "border-l-2 border-primary/25")}>
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-6 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground lg:px-8">
                {t("sessions.colSession")}
              </th>
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("sessions.colComposition")}
              </th>
              <th className="w-28 px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("sessions.colUpdated")}
              </th>
              <th className="w-28 px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("sessions.colStatus")}
              </th>
              <th className="w-14 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
                {sessionsQuery.isLoading ? (
                  <TableEmptyRow message={t("sessions.loading")} />
                ) : visibleSessions.length === 0 ? (
                  <TableEmptyRow
                    message={
                      showArchived
                        ? t("sessions.noArchivedYet")
                        : t("sessions.emptyState")
                    }
                  />
                ) : (
                  visibleSessions.map((session) => {
                    const isSelected = selectedSessionId === session.id;

                    return (
                      <tr
                        key={session.id}
                        className={cn(
                          "group cursor-pointer border-b border-border/30 transition-colors duration-100",
                          isSelected ? "bg-primary/5" : "hover:bg-[hsl(var(--surface-muted)/0.6)]",
                        )}
                        onClick={() => openModal(session)}
                      >
                        <td className="px-6 py-3.5 align-middle lg:px-8">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              title={t("sessions.action.launch")}
                              disabled={launchMutation.isPending}
                              className={cn(
                                "group relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-200",
                                "border-orange-400 bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg shadow-orange-200/60",
                                "hover:scale-110 hover:shadow-xl hover:shadow-orange-300/70 active:scale-95",
                                "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100",
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                launchMutation.mutate(session.id);
                              }}
                            >
                              <AnimatedRocket className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 pl-0.5">
                              <p className="truncate text-[0.88rem] font-medium text-foreground">
                                {session.name}
                              </p>
                              <p className="truncate text-[0.78rem] text-muted-foreground">
                                {session.description ?? t("sessions.noDescription")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                              {t("sessions.compositionPrompts", { count: session.prompts.length })}
                            </Badge>
                            <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                              {t("sessions.compositionCandidates", { count: session.candidates.length })}
                            </Badge>
                            <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                              {t("sessions.compositionJudges", { count: session.judges.length })}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-middle text-[0.78rem] text-muted-foreground">
                          {formatDate(session.updated_at)}
                        </td>
                        <td
                          className="px-4 py-3.5 align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatusPickerSessionId(statusPickerSessionId === session.id ? null : session.id);
                              }}
                              className="cursor-pointer"
                            >
                              <Badge
                                className="whitespace-nowrap text-[0.7rem]"
                                variant={session.status === "archived" ? "muted" : session.status === "ready" ? "success" : "neutral"}
                              >
                                {t(`sessions.form.status.${session.status}`)}
                              </Badge>
                            </button>
                            {statusPickerSessionId === session.id ? (
                              <div className="absolute left-0 top-[calc(100%+0.4rem)] z-[90] min-w-[12rem] overflow-hidden rounded-xl border border-border bg-[hsl(var(--surface-elevated))] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.5)]">
                                <div className="border-b border-border/60 px-3 py-2.5">
                                  <p className="text-[0.78rem] font-semibold text-foreground">
                                    {t("sessions.form.status")}
                                  </p>
                                </div>
                                <div className="py-1">
                                {(["draft", "ready", "archived"] as const).map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-2 px-3 py-2 text-left text-[0.82rem] transition",
                                      session.status === s
                                        ? "bg-primary/10 font-semibold text-primary"
                                        : "text-foreground hover:bg-[hsl(var(--surface-muted))]",
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setStatusPickerSessionId(null);
                                      if (s !== session.status) {
                                        updateStatusMutation.mutate({ session, status: s });
                                      }
                                    }}
                                  >
                                    {t(`sessions.form.status.${s}`)}
                                  </button>
                                ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-middle" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <ActionIconButton
                              aria-label={`${t("sessions.action.archive")} ${session.name}`}
                              description={t("sessions.action.archiveDesc")}
                              disabled={
                                archiveMutation.isPending || session.status === "archived"
                              }
                              label={t("sessions.action.archive")}
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

      <Modal
        onClose={() => setIsModalOpen(false)}
        open={isModalOpen}
        size="xl"
        tone="emerald"
        title={selectedSession
          ? t("sessions.configureModal.title", { name: selectedSession.name })
          : t("sessions.createModal.title")}
      >
        <div className="space-y-4">
          <SessionStepSwitcher
            activeStep={selectionStep}
            onStepChange={setSelectionStep}
            session={selectedSession}
          />

          {selectionStep === "information" ? (
            <form>
              {loadError ? (
                <LoadErrorState compact message={loadError} resourceLabel="sessions" />
              ) : null}

              <div className="flex min-h-0 gap-0">
                <div className="w-56 shrink-0 space-y-5 border-r border-border/50 pr-6">
                  <Field label={t("sessions.form.name")}>
                    <Input
                      placeholder={t("sessions.form.namePlaceholder")}
                      value={formState.name}
                      onChange={(event) => {
                        isDirtyRef.current = true;
                        setFormState((current) => ({ ...current, name: event.target.value }));
                      }}
                    />
                  </Field>

                  <Field label={t("sessions.form.status")}>
                    <Select
                      value={formState.status}
                      onChange={(event) => {
                        isDirtyRef.current = true;
                        setFormState((current) => ({
                          ...current,
                          status: event.target.value as SessionFormState["status"],
                        }));
                      }}
                    >
                      <option value="draft">{t("sessions.form.status.draft")}</option>
                      <option value="ready">{t("sessions.form.status.ready")}</option>
                      <option value="archived">{t("sessions.form.status.archived")}</option>
                    </Select>
                  </Field>
                </div>

                <div className="min-w-0 flex-1 space-y-5 pl-6">
                  <Field label={t("sessions.form.description")}>
                    <Textarea
                      className="min-h-32"
                      placeholder={t("sessions.form.descriptionPlaceholder")}
                      value={formState.description}
                      onChange={(event) => {
                        isDirtyRef.current = true;
                        setFormState((current) => ({ ...current, description: event.target.value }));
                      }}
                    />
                  </Field>
                </div>
              </div>

              {feedback ? (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/8 px-4 py-2.5 text-[0.82rem] text-primary">
                  {feedback}
                </div>
              ) : null}

              {saveMutation.isPending ? (
                <p className="mt-4 text-xs text-muted-foreground">{t("sessions.syncing")}</p>
              ) : null}
            </form>
          ) : null}

          {selectionStep !== "information" && !selectedSession ? (
            <div className="rounded-lg border border-primary/20 bg-primary/8 px-4 py-2.5 text-[0.82rem] text-primary">
              {t("sessions.form.saveBeforeContinue")}
            </div>
          ) : null}

          {selectionStep === "prompts" && selectedSession ? (
            <SelectionWorkspace
              filters={
                <PromptFilters
                  categories={allPromptCategories}
                  difficulties={allPromptDifficulties}
                  selectedCategories={promptCategoryFilter}
                  selectedDifficulties={promptDifficultyFilter}
                  onCategoriesChange={setPromptCategoryFilter}
                  onDifficultiesChange={setPromptDifficultyFilter}
                />
              }
              search={promptSearch}
              title={t("sessions.selection.prompts")}
              onSearchChange={setPromptSearch}
            >
              <SelectedList
                emptyMessage={t("sessions.selection.noPromptsYet")}
                items={selectedSession.prompts.map((item) => {
                  const prompt = promptsQuery.data?.items.find((p) => p.id === item.prompt_id);
                  const isCodeGen = item.scenario_type === "code_generation";
                  return {
                    id: item.id,
                    label: item.prompt_name,
                    meta:
                      [
                        item.category_name ?? prompt?.category.name,
                        item.cost_tier ? `cost ${item.cost_tier}` : null,
                        item.estimated_input_tokens ? `${item.estimated_input_tokens} tok` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                      t("sessions.selection.orderPrefix", { order: item.display_order }),
                    difficulty: prompt?.difficulty ?? null,
                    samplingMode: isCodeGen ? item.sampling_mode : null,
                    onToggleSamplingMode: isCodeGen
                      ? () => updateSamplingModeMutation.mutate({
                          sessionId: selectedSession.id,
                          itemId: item.id,
                          mode: item.sampling_mode === "iterative" ? "independent" : "iterative",
                        })
                      : undefined,
                  };
                })}
                onRemove={(itemId) =>
                  removePromptMutation.mutate({ sessionId: selectedSession.id, itemId })
                }
              />
              <LibraryList
                items={availablePrompts.map((prompt) => ({
                  id: prompt.id,
                  label: prompt.name,
                  meta: [
                    prompt.category.name,
                    prompt.cost_tier ? `cost ${prompt.cost_tier}` : null,
                    prompt.estimated_input_tokens ? `${prompt.estimated_input_tokens} tok` : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  difficulty: prompt.difficulty,
                }))}
                onAdd={(promptId) =>
                  addPromptMutation.mutate({ sessionId: selectedSession.id, promptId })
                }
              />
            </SelectionWorkspace>
          ) : null}

          {selectionStep === "candidates" && selectedSession ? (
            <SelectionWorkspace
              search={candidateSearch}
              title={t("sessions.selection.candidates")}
              onSearchChange={setCandidateSearch}
            >
              <SelectedList
                emptyMessage={t("sessions.selection.noCandidatesYet")}
                items={selectedSession.candidates.map((item) => ({
                  id: item.id,
                  label: item.display_name,
                  meta: `${item.provider_type} / ${item.runtime_type}`,
                }))}
                onRemove={(itemId) =>
                  removeCandidateMutation.mutate({ sessionId: selectedSession.id, itemId })
                }
              />
              <LibraryList
                items={availableCandidates.map((model) => ({
                  id: model.id,
                  label: model.display_name,
                  meta: `${model.provider_type} / ${model.runtime_type}`,
                }))}
                onAdd={(modelId) =>
                  addCandidateMutation.mutate({ sessionId: selectedSession.id, modelId })
                }
              />
            </SelectionWorkspace>
          ) : null}

          {selectionStep === "judges" && selectedSession ? (
            <SelectionWorkspace
              search={judgeSearch}
              title={t("sessions.selection.judges")}
              onSearchChange={setJudgeSearch}
            >
              <SelectedList
                emptyMessage={t("sessions.selection.noJudgeYet")}
                items={selectedSession.judges.map((item) => ({
                  id: item.id,
                  label: item.display_name,
                  meta: `${item.provider_type} / ${item.runtime_type}`,
                }))}
                onRemove={(itemId) =>
                  removeJudgeMutation.mutate({ sessionId: selectedSession.id, itemId })
                }
              />
              <LibraryList
                items={availableJudges.map((model) => ({
                  id: model.id,
                  label: model.display_name,
                  meta: `${model.provider_type} / ${model.runtime_type}`,
                }))}
                onAdd={(modelId) =>
                  addJudgeMutation.mutate({ sessionId: selectedSession.id, modelId })
                }
              />
            </SelectionWorkspace>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/50 pt-4">
            <Button onClick={() => setIsModalOpen(false)} type="button" variant="soft">
              {t("sessions.selection.close")}
            </Button>
            {selectionStep !== "judges" ? (
              <Button
                disabled={selectionStep !== "information" && !selectedSession}
                onClick={() =>
                  setSelectionStep(
                    selectionStep === "information"
                      ? "prompts"
                      : selectionStep === "prompts"
                        ? "candidates"
                        : "judges",
                  )
                }
                type="button"
                variant="secondary"
              >
                {t("sessions.selection.nextStep")}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}
