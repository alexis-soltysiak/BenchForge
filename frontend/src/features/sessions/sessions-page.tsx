import type { ComponentProps, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  Archive,
  BadgeInfo,
  Layers3,
  Plus,
  RotateCcw,
  Rocket,
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
};

const emptyForm: SessionFormState = {
  name: "",
  description: "",
  status: "draft",
};

function toFormState(session: Session): SessionFormState {
  return {
    name: session.name,
    description: session.description ?? "",
    status: session.status,
  };
}

function toPayload(state: SessionFormState): SessionPayload {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    status: state.status,
    rubric_version: "mvp-v1",
  };
}

function formatDate(value: string): string {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
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

type SessionSelectionStep = "information" | "prompts" | "candidates" | "judges";

const ROCKET_LAUNCH_CSS = `
@keyframes rocket-launch {
  0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
  12%  { transform: translate(-3px, 3px) rotate(-8deg); opacity: 1; }
  40%  { transform: translate(18px, -18px) rotate(25deg); opacity: 0; }
  41%  { transform: translate(0,0) rotate(0deg); opacity: 0; }
  88%  { transform: translate(0,0) rotate(0deg); opacity: 0; }
  100% { transform: translate(0,0) rotate(0deg); opacity: 1; }
}
.rocket-firing {
  animation: rocket-launch 4s cubic-bezier(0.4,0,0.2,1) forwards;
}
`;

function AnimatedRocket({ className }: { className?: string }) {
  const [key, setKey] = useState(0);
  const [firing, setFiring] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function schedule() {
      const delay = 4000 + Math.random() * 8000;
      timeout = setTimeout(() => {
        setFiring(true);
        setKey((k) => k + 1);
        setTimeout(() => {
          setFiring(false);
          schedule();
        }, 2000);
      }, delay);
    }

    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      <style>{ROCKET_LAUNCH_CSS}</style>
      <Rocket key={key} className={cn(className, firing && "rocket-firing")} />
    </>
  );
}

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
                  <Field hint={t("sessions.form.nameHint")} label={t("sessions.form.name")}>
                    <Input
                      placeholder={t("sessions.form.namePlaceholder")}
                      value={formState.name}
                      onChange={(event) => {
                        isDirtyRef.current = true;
                        setFormState((current) => ({ ...current, name: event.target.value }));
                      }}
                    />
                  </Field>

                  <Field hint={t("sessions.form.statusHint")} label={t("sessions.form.status")}>
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
                  <Field hint={t("sessions.form.descriptionHint")} label={t("sessions.form.description")}>
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
              {t("sessions.form.nameHint")}
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
                  return {
                    id: item.id,
                    label: item.prompt_name,
                    meta: prompt?.category.name ?? t("sessions.selection.orderPrefix", { order: item.display_order }),
                    difficulty: prompt?.difficulty ?? null,
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
                  meta: prompt.category.name,
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

function TableEmptyRow({ message }: { message: string }) {
  return (
    <tr className="border-t border-border/30">
      <td className="px-5 py-12 text-center text-sm text-muted-foreground/50" colSpan={5}>
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
  items: Array<{ id: number; label: string; meta: string; difficulty?: number | null }>;
  onRemove: (itemId: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("sessions.selection.selected")}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">{emptyMessage ?? "Nothing selected yet."}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-[hsl(var(--surface-muted))] px-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.difficulty != null ? <DifficultyBadge value={item.difficulty} /> : null}
                <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
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
              <div className="relative rounded-2xl border border-border bg-[hsl(var(--surface-overlay))] p-3 text-left shadow-[0_24px_60px_-22px_rgba(15,23,42,0.22)] ring-1 ring-[hsl(var(--border)/0.6)] backdrop-blur-sm">
                <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-border bg-[hsl(var(--surface-overlay))]" />
                <div className="relative overflow-hidden rounded-xl border border-border bg-[linear-gradient(135deg,_hsl(var(--surface-muted)),_hsl(var(--surface)))] p-3">
                  <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-emerald-400" />
                  <div className="flex items-start gap-3 pl-2">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--theme-success-soft))] text-[hsl(var(--theme-success-foreground))] shadow-sm">
                      <BadgeInfo className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="mt-1 text-xs leading-5 text-[hsl(var(--foreground-soft))]">
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
  session: Session | null;
}) {
  const { t } = useTranslation();

  const steps = [
    {
      key: "information" as const,
      count: null as number | null,
      icon: BadgeInfo,
      label: t("sessions.selection.information"),
      disabled: false,
      activeClassName:
        "border-slate-300 bg-slate-50 text-slate-900 shadow-sm",
      idleClassName:
        "border-border/80 bg-[hsl(var(--surface))] text-foreground hover:border-slate-300 hover:bg-slate-50/80",
      iconClassName: "bg-slate-100 text-slate-600",
      badgeVariant: "neutral" as const,
    },
    {
      key: "prompts" as const,
      count: session?.prompts.length ?? null,
      icon: Layers3,
      label: t("sessions.selection.prompts"),
      disabled: !session,
      activeClassName:
        "border-[hsl(var(--theme-success-border))] bg-[hsl(var(--theme-success-soft))] text-[hsl(var(--theme-success-foreground))] shadow-sm",
      idleClassName:
        "border-border/80 bg-[hsl(var(--surface))] text-foreground hover:border-[hsl(var(--theme-success-border))] hover:bg-[hsl(var(--theme-success-soft)/0.6)]",
      iconClassName: "bg-[hsl(var(--theme-success-soft))] text-[hsl(var(--theme-success-foreground))]",
      badgeVariant: "success" as const,
    },
    {
      key: "candidates" as const,
      count: session?.candidates.length ?? null,
      icon: Users,
      label: t("sessions.selection.candidates"),
      disabled: !session,
      activeClassName:
        "border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))] shadow-sm",
      idleClassName:
        "border-border/80 bg-[hsl(var(--surface))] text-foreground hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-soft)/0.6)]",
      iconClassName: "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]",
      badgeVariant: "neutral" as const,
    },
    {
      key: "judges" as const,
      count: session?.judges.length ?? null,
      icon: ShieldCheck,
      label: t("sessions.selection.judges"),
      disabled: !session,
      activeClassName:
        "border-[hsl(var(--theme-warning-border))] bg-[hsl(var(--theme-warning-soft))] text-[hsl(var(--theme-warning-foreground))] shadow-sm",
      idleClassName:
        "border-border/80 bg-[hsl(var(--surface))] text-foreground hover:border-[hsl(var(--theme-warning-border))] hover:bg-[hsl(var(--theme-warning-soft)/0.6)]",
      iconClassName: "bg-[hsl(var(--theme-warning-soft))] text-[hsl(var(--theme-warning-foreground))]",
      badgeVariant: "success" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {steps.map((step) => {
        const Icon = step.icon;
        const isActive = step.key === activeStep;

        return (
          <button
            key={step.key}
            disabled={step.disabled}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition",
              isActive ? step.activeClassName : step.idleClassName,
              step.disabled && "cursor-not-allowed opacity-40",
            )}
            onClick={() => !step.disabled && onStepChange(step.key)}
            type="button"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-sm",
                    step.iconClassName,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold">{step.label}</p>
                  {step.count !== null ? (
                    <p className="text-[0.7rem] text-[hsl(var(--foreground-soft))]">
                      {t("sessions.selection.count", { count: step.count })}
                    </p>
                  ) : (
                    <p className="text-[0.7rem] text-[hsl(var(--foreground-soft))]">
                      {session ? t("sessions.selection.saved") : t("sessions.selection.new")}
                    </p>
                  )}
                </div>
              </div>
              {isActive ? (
                <Badge variant={step.badgeVariant} className="shrink-0 text-[0.6rem]">
                  {t("sessions.selection.current")}
                </Badge>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SelectionWorkspace({
  children,
  filters,
  search,
  title,
  onSearchChange,
}: {
  children: ReactNode;
  filters?: ReactNode;
  search: string;
  title: string;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {filters ? <div>{filters}</div> : null}
          <label className="relative block min-w-full lg:min-w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-lg pl-8 text-sm"
              placeholder={t("sessions.selection.searchLibrary", { type: title.toLowerCase() })}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        </div>
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
  items: Array<{ id: number; label: string; meta: string; difficulty?: number | null }>;
  onAdd: (itemId: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("sessions.selection.library")}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">{t("sessions.selection.noItems")}</p>
      ) : (
        items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-[hsl(var(--surface))] px-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.difficulty != null ? <DifficultyBadge value={item.difficulty} /> : null}
                <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => onAdd(item.id)}>
              {t("sessions.selection.add")}
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
    <label className="space-y-1.5">
      <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {hint ? (
        <span className="block text-xs leading-5 text-muted-foreground">{hint}</span>
      ) : null}
      <span className="block">
        {children}
      </span>
    </label>
  );
}

const DIFFICULTY_STYLES: Record<number, string> = {
  1: "bg-emerald-500 text-white",
  2: "bg-cyan-500 text-white",
  3: "bg-amber-500 text-white",
  4: "bg-orange-500 text-white",
  5: "bg-red-500 text-white",
};

function DifficultyBadge({ value }: { value: number }) {
  const style = DIFFICULTY_STYLES[value] ?? "bg-slate-500 text-white";
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        style,
      )}
    >
      {value}
    </span>
  );
}

function PromptFilters({
  categories,
  difficulties,
  selectedCategories,
  selectedDifficulties,
  onCategoriesChange,
  onDifficultiesChange,
}: {
  categories: Array<{ slug: string; name: string }>;
  difficulties: number[];
  selectedCategories: string[];
  selectedDifficulties: number[];
  onCategoriesChange: (v: string[]) => void;
  onDifficultiesChange: (v: number[]) => void;
}) {
  const { t } = useTranslation();

  const toggleCategory = (slug: string) =>
    onCategoriesChange(
      selectedCategories.includes(slug)
        ? selectedCategories.filter((s) => s !== slug)
        : [...selectedCategories, slug],
    );

  const toggleDifficulty = (d: number) =>
    onDifficultiesChange(
      selectedDifficulties.includes(d)
        ? selectedDifficulties.filter((x) => x !== d)
        : [...selectedDifficulties, d],
    );

  return (
    <div className="flex flex-col gap-3">
      {categories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("sessions.selection.filterCategory")}
          </span>
          {categories.map((cat) => {
            const active = selectedCategories.includes(cat.slug);
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => toggleCategory(cat.slug)}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg border px-3 text-[0.82rem] font-medium transition",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {difficulties.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("sessions.selection.filterDifficulty")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
          {difficulties.map((d) => {
            const active = selectedDifficulties.includes(d);
            const style = DIFFICULTY_STYLES[d] ?? "bg-slate-500 text-white";
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDifficulty(d)}
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
    </div>
  );
}
