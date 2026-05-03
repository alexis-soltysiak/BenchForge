import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Award,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  DollarSign,
  Download,
  Eye,
  FileCode,
  FileImage,
  FileText,
  Gavel,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  SquareTerminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Modal } from "@/components/ui/modal";
import {
  clearRunJudging,
  confirmLocalReady,
  deleteRun,
  downloadRunReportHtml,
  downloadRunReportPdf,
  downloadRunReportSvg,
  downloadRunReportSummarySvg,
  fetchLocalNext,
  fetchRun,
  fetchRunJudging,
  fetchRunResponses,
  fetchRuns,
  generateAndDownloadAll,
  regenerateAndDownloadHtml,
  restartRunJudging,
  retryCandidateResponse,
  retryJudgeBatch,
  retryRunJudging,
  startLocalCurrent,
  startRemoteCandidate,
  startRunJudging,
} from "@/features/runs/api";
import type {
  CandidateResponse,
  DifficultyBreakdown,
  JudgeBatch,
  JudgeEvaluationCandidate,
  LocalExecutionNextResponse,
  PassAtKSummary,
  Run,
  RunGlobalSummary,
  RunJudging,
  RunModelSnapshot,
  RunPromptSnapshot,
} from "@/features/runs/types";
import { API_URL, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type RunsPageProps = {
  onOpenRun: (runId: number) => void;
};

type RunDetailPageProps = {
  onBack: () => void;
  runId: number;
};

type RunPhaseKey = "phase1" | "phase2" | "phase3";

const terminalStatuses = new Set(["completed", "failed", "cancelled"]);

function isServiceAvailabilityError(message: string | null): boolean {
  if (!message) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("database unavailable") ||
    normalizedMessage.includes("backend unavailable")
  );
}

export function RunsPage({ onOpenRun }: RunsPageProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [previewRun, setPreviewRun] = useState<{ id: number; name: string } | null>(null);
  const [deleteConfirmRun, setDeleteConfirmRun] = useState<{ id: number; name: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (runId: number) => deleteRun(runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["runs"] });
      setDeleteConfirmRun(null);
    },
  });

  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: fetchRuns,
    refetchInterval: 5000,
  });

  const visibleRuns = useMemo(() => {
    let items = runsQuery.data?.items ?? [];
    if (statusFilter) {
      const activeStatuses = ["running", "running_candidates", "waiting_local", "ready_for_judging", "judging", "aggregating", "reporting"];
      if (statusFilter === "active") {
        items = items.filter((item) => activeStatuses.includes(item.status));
      } else {
        items = items.filter((item) => item.status === statusFilter);
      }
    }
    if (!search) return items;
    const needle = search.toLowerCase();
    return items.filter((item) =>
      [item.name, item.status, item.report_status, item.rubric_version]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [runsQuery.data?.items, search, statusFilter]);

  const completedRuns = visibleRuns.filter((item) => item.status === "completed").length;
  const activeRuns = visibleRuns.filter((item) =>
    ["running", "running_candidates", "waiting_local", "ready_for_judging", "judging", "aggregating", "reporting"].includes(
      item.status,
    ),
  ).length;
  const readyReports = visibleRuns.filter((item) => item.report_status === "completed").length;
  const completedVisibleRuns = visibleRuns.filter((item) => item.status === "completed");
  const completedRunQueries = useQueries({
    queries: completedVisibleRuns.map((item) => ({
      queryKey: ["runs", item.id, "list-detail"],
      queryFn: () => fetchRun(item.id),
      staleTime: 60_000,
      refetchInterval: false,
    })),
  });
  const completedRunDetails = useMemo(() => {
    const map = new Map<number, Run>();
    completedVisibleRuns.forEach((item, index) => {
      const data = completedRunQueries[index]?.data;
      if (data) {
        map.set(item.id, data);
      }
    });
    return map;
  }, [completedRunQueries, completedVisibleRuns]);
  const loadError =
    (runsQuery.error instanceof ApiError && runsQuery.error.message) || null;
  const retryLoad = () => {
    void runsQuery.refetch();
  };
  const hasAnyFilters = Boolean(search.trim()) || statusFilter !== null;

  return (
    <div className="text-foreground">
      <header className="border-b border-border/50 px-6 pb-6 pt-8 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.28em] text-primary/80">
              {t("runs.executionMonitor")}
            </p>
            <h1 className="text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
              {t("runs.pageTitle")}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{visibleRuns.length}</span>{" "}
                  {t("runs.metricVisible").toLowerCase()}
                </span>
              </div>
              <span className="mx-1.5 text-border/60">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{completedRuns}</span>{" "}
                  {t("runs.metricCompleted").toLowerCase()}
                </span>
              </div>
              <span className="mx-1.5 text-border/60">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <SquareTerminal className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{activeRuns}</span>{" "}
                  {t("runs.metricActive").toLowerCase()}
                </span>
              </div>
              <span className="mx-1.5 text-border/60">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Gavel className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{readyReports}</span>{" "}
                  {t("runs.metricReports").toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-6 py-3 lg:px-8">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 w-52 rounded-lg pl-8 text-sm"
            placeholder={t("runs.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        {([null, "active", "completed", "failed"] as const).map((s) => (
          <button
            key={String(s)}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-medium transition",
              statusFilter === s
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
            )}
          >
            {s === null ? "Tous" : s === "active" ? "En cours" : s === "completed" ? "Terminés" : "Échoués"}
          </button>
        ))}

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
              setStatusFilter(null);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loadError ? (
        <LoadErrorState
          message={loadError}
          onRetry={retryLoad}
          resourceLabel={t("runs.pageTitle")}
        />
      ) : null}

      <div>
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-6 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground lg:px-8">
                {t("runs.pageTitle")}
              </th>
              <th className="w-28 px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Statut
              </th>
              <th className="px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Résultat
              </th>
              <th className="w-48 px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Composition
              </th>
              <th className="w-32 px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Chronologie
              </th>
              <th className="w-14 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {runsQuery.isLoading ? (
              <RunsTableEmptyRow message={t("runs.loading")} />
            ) : visibleRuns.length === 0 ? (
              <RunsTableEmptyRow message={t("runs.noRuns")} />
            ) : (
              visibleRuns.map((item) => {
                const detailedRun = completedRunDetails.get(item.id);
                const topSummaries = detailedRun ? getTopRunListSummaries(detailedRun, 3) : [];
                const completionLabel =
                  item.status === "completed" && detailedRun?.completed_at
                    ? `Terminé ${formatRunListDateTimeShort(detailedRun.completed_at)}`
                    : `Lancé ${formatDate(item.launched_at)}`;

                return (
                  <tr
                    key={item.id}
                    className="group cursor-pointer border-b border-border/30 transition-colors duration-100 hover:bg-[hsl(var(--surface-muted)/0.6)]"
                    onClick={() => onOpenRun(item.id)}
                  >
                    <td className="px-6 py-3.5 align-middle lg:px-8">
                      <div className="min-w-0">
                        <p className="truncate text-[0.88rem] font-medium text-foreground">
                          {item.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.78rem] text-muted-foreground">
                          <span>{item.rubric_version}</span>
                          <span className="text-border/60">·</span>
                          <span>
                            rapport{" "}
                            <span className={cn(
                              "font-medium",
                              item.report_status === "completed" ? "text-foreground" : "text-muted-foreground",
                            )}
                            >
                              {item.report_status}
                            </span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {item.status === "completed" ? (
                        detailedRun ? (
                          topSummaries.length > 0 ? (
                            <RunTopThreeSummary run={detailedRun} summaries={topSummaries} />
                          ) : (
                            <div className="min-w-0 text-[0.78rem] text-muted-foreground">
                              Résumés globaux indisponibles
                            </div>
                          )
                        ) : (
                          <div className="min-w-0 text-[0.78rem] text-muted-foreground">
                            Chargement du résumé…
                          </div>
                        )
                      ) : (
                        <div className="min-w-0 text-[0.78rem] text-muted-foreground">
                          {item.report_status === "completed"
                            ? "Rapport prêt"
                            : "Résultat final non disponible"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle text-[0.78rem] text-muted-foreground">
                      <div className="flex flex-wrap gap-3">
                        <span><span className="font-semibold text-foreground">{item.prompt_count}</span> scénarios</span>
                        <span><span className="font-semibold text-foreground">{item.model_count}</span> candidats</span>
                        <span><span className="font-semibold text-foreground">{item.judge_count}</span> juges</span>
                        {detailedRun ? (
                          <span><span className="font-semibold text-foreground">{detailedRun.candidate_response_count}</span> réponses</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-[0.78rem] text-muted-foreground">
                      <div className="space-y-1">
                        <p>{completionLabel}</p>
                        {item.status === "completed" && detailedRun?.completed_at ? (
                          <p>{formatRunListElapsed(item.launched_at, detailedRun.completed_at)}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle" onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {item.status === "completed" ? (
                          <Button
                            aria-label={`Preview report for ${item.name}`}
                            onClick={() => setPreviewRun({ id: item.id, name: item.name })}
                            size="iconSm"
                            title={`Preview report for ${item.name}`}
                            type="button"
                            variant="soft"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          aria-label={`Delete run ${item.name}`}
                          onClick={() => setDeleteConfirmRun({ id: item.id, name: item.name })}
                          size="iconSm"
                          title={`Delete run ${item.name}`}
                          type="button"
                          variant="soft"
                          className="text-rose-500 hover:bg-rose-500/10"
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

      <Modal
        description={t("runs.preview.title")}
        onClose={() => setPreviewRun(null)}
        open={previewRun !== null}
        size="xl"
        title={previewRun ? `${t("runs.preview.title")} · ${previewRun.name}` : t("runs.preview.title")}
      >
        {previewRun ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-[hsl(var(--surface))]">
            <iframe
              className="h-[78vh] w-full"
              src={`${API_URL}/runs/${previewRun.id}/report/pdf`}
              title={`Report preview for ${previewRun.name}`}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        onClose={() => { if (!deleteMutation.isPending) setDeleteConfirmRun(null); }}
        open={deleteConfirmRun !== null}
        size="md"
        title="Delete run"
        description="This action cannot be undone."
      >
        {deleteConfirmRun ? (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteConfirmRun.name}</span>? All responses, judgings, and reports will be permanently removed.
            </p>
            {deleteMutation.error ? (
              <p className="text-sm text-destructive">
                {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Failed to delete run."}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteConfirmRun(null)}
                type="button"
                variant="soft"
              >
                Cancel
              </Button>
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteConfirmRun.id)}
                type="button"
                variant="danger"
              >
                {deleteMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function RunDetailPage({ onBack, runId }: RunDetailPageProps) {
  const [activePhase, setActivePhase] = useState<RunPhaseKey>("phase1");
  const [selectedResponseId, setSelectedResponseId] = useState<number | null>(null);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [selectedJudgeBatchId, setSelectedJudgeBatchId] = useState<number | null>(null);
  const [selectedJudgingPromptId, setSelectedJudgingPromptId] = useState<number | null>(null);
  const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [startingRemoteIds, setStartingRemoteIds] = useState<number[]>([]);
  const [retryingResponseIds, setRetryingResponseIds] = useState<number[]>([]);
  const [retryingBatchIds, setRetryingBatchIds] = useState<number[]>([]);

  const runQuery = useQuery({
    queryKey: ["runs", runId],
    queryFn: () => fetchRun(runId),
    refetchInterval: (query) => {
      const run = query.state.data as Run | undefined;
      if (run && !terminalStatuses.has(run.status)) return 4000;
      if (retryingResponseIds.length > 0) return 4000;
      if (retryingBatchIds.length > 0) return 4000;
      return false;
    },
  });

  const responsesQuery = useQuery({
    queryKey: ["runs", runId, "responses"],
    queryFn: () => fetchRunResponses(runId),
    refetchInterval: (query) => {
      if (runQuery.data && !terminalStatuses.has(runQuery.data.status)) return 4000;
      if (retryingResponseIds.length > 0) return 4000;
      const items = (query.state.data as { items: CandidateResponse[] } | undefined)?.items ?? [];
      if (items.some((r) => r.status === "pending" || r.status === "running")) return 4000;
      return false;
    },
  });

  const hasLocalCandidates =
    runQuery.data?.model_snapshots.some(
      (item) => item.role === "candidate" && item.runtime_type === "local",
    ) ?? false;

  const localNextQuery = useQuery({
    queryKey: ["runs", runId, "local-next"],
    queryFn: () => fetchLocalNext(runId),
    enabled: hasLocalCandidates,
    refetchInterval: () =>
      runQuery.data && !terminalStatuses.has(runQuery.data.status) ? 4000 : false,
  });

  const judgingQuery = useQuery({
    queryKey: ["runs", runId, "judging"],
    queryFn: () => fetchRunJudging(runId),
    refetchInterval: () => {
      if (runQuery.data && !terminalStatuses.has(runQuery.data.status)) return 4000;
      if (retryingBatchIds.length > 0) return 4000;
      return false;
    },
  });

  useEffect(() => {
    const items = responsesQuery.data?.items ?? [];
    if (items.length === 0) {
      setSelectedResponseId(null);
      setIsResponseModalOpen(false);
      return;
    }

    if (selectedResponseId && items.some((item) => item.id === selectedResponseId)) {
      return;
    }

    setSelectedResponseId(items[0].id);
  }, [responsesQuery.data?.items, selectedResponseId]);

  useEffect(() => {
    const items = judgingQuery.data?.items ?? [];
    if (items.length === 0) {
      setSelectedJudgeBatchId(null);
      setSelectedJudgingPromptId(null);
      return;
    }

    if (selectedJudgeBatchId && items.some((item) => item.id === selectedJudgeBatchId)) {
      // keep existing batch selection for modal
    } else {
      setSelectedJudgeBatchId(items[0].id);
    }

    if (!selectedJudgingPromptId || !items.some((item) => item.prompt_snapshot_id === selectedJudgingPromptId)) {
      setSelectedJudgingPromptId(items[0].prompt_snapshot_id);
    }
  }, [judgingQuery.data?.items, selectedJudgeBatchId, selectedJudgingPromptId]);

  const refreshRunData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["runs"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", runId] }),
      queryClient.invalidateQueries({ queryKey: ["runs", runId, "responses"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", runId, "local-next"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", runId, "judging"] }),
    ]);
  };

  const confirmLocalMutation = useMutation({
    mutationFn: () => confirmLocalReady(runId),
    onSuccess: async (payload) => {
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : "Unable to confirm local readiness.",
      );
    },
  });

  const startLocalMutation = useMutation({
    mutationFn: () => startLocalCurrent(runId),
    onSuccess: async () => {
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : "Unable to start local model.",
      );
    },
  });

  const handleStartRemoteCandidate = async (modelSnapshotId: number) => {
    setStartingRemoteIds((current) => [...current, modelSnapshotId]);
    try {
      await startRemoteCandidate(runId, modelSnapshotId);
      await refreshRunData();
    } catch (error) {
      setFeedback(
        error instanceof ApiError ? error.message : "Unable to start endpoint candidate.",
      );
    } finally {
      setStartingRemoteIds((current) => current.filter((item) => item !== modelSnapshotId));
    }
  };

  const handleRetryResponse = async (responseId: number) => {
    setRetryingResponseIds((current) => [...current, responseId]);
    try {
      await retryCandidateResponse(runId, responseId);
      await refreshRunData();
    } catch (error) {
      setFeedback(
        error instanceof ApiError ? error.message : "Unable to retry scenario response.",
      );
    } finally {
      setRetryingResponseIds((current) => current.filter((item) => item !== responseId));
    }
  };

  const retryJudgingMutation = useMutation({
    mutationFn: () => retryRunJudging(runId),
    onSuccess: async () => {
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to retry judging.");
    },
  });

  const clearJudgingMutation = useMutation({
    mutationFn: () => clearRunJudging(runId),
    onSuccess: async () => {
      setSelectedJudgeBatchId(null);
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to clear phase 2.");
    },
  });

  const restartJudgingMutation = useMutation({
    mutationFn: () => restartRunJudging(runId),
    onSuccess: async () => {
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to restart phase 2.");
    },
  });

  const handleRetryBatch = async (batchId: number) => {
    setRetryingBatchIds((current) => [...current, batchId]);
    try {
      await retryJudgeBatch(runId, batchId);
      await refreshRunData();
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : "Unable to retry batch.");
    } finally {
      setRetryingBatchIds((current) => current.filter((item) => item !== batchId));
    }
  };

  const startJudgingMutation = useMutation({
    mutationFn: () => startRunJudging(runId),
    onMutate: async () => {
      setActivePhase("phase2");
      if (!selectedRun) {
        return;
      }

      const optimisticJudging = buildOptimisticJudging(selectedRun);
      queryClient.setQueryData(["runs", runId, "judging"], optimisticJudging);
      setSelectedJudgeBatchId(optimisticJudging.items[0]?.id ?? null);
      setFeedback(null);
    },
    onSuccess: async () => {
      setFeedback(null);
      await queryClient.invalidateQueries({ queryKey: ["runs", runId, "judging"] });
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to start judging.");
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: () => downloadRunReportPdf(runId),
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to download PDF report.");
    },
  });

  const downloadHtmlMutation = useMutation({
    mutationFn: () => regenerateAndDownloadHtml(runId),
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to download HTML report.");
    },
  });

  const downloadSvgMutation = useMutation({
    mutationFn: () => downloadRunReportSvg(runId),
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to download SVG charts.");
    },
  });

  const downloadSummarySvgMutation = useMutation({
    mutationFn: () => downloadRunReportSummarySvg(runId),
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to download summary SVG.");
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: () => generateAndDownloadAll(runId),
    onSuccess: async () => {
      setFeedback(null);
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to generate all reports.");
    },
  });

  const selectedRun = runQuery.data;
  const rawResponses = responsesQuery.data?.items ?? [];
  const effectiveResponses = useMemo(
    () => consolidateCandidateResponses(rawResponses),
    [rawResponses],
  );
  const selectedResponse =
    effectiveResponses.find((item) => item.id === selectedResponseId) ?? null;
  const judging = judgingQuery.data;
  const selectedJudgeBatch =
    judging?.items.find((item) => item.id === selectedJudgeBatchId) ?? null;
  const candidateSnapshots = selectedRun
    ? selectedRun.model_snapshots.filter((item) => item.role === "candidate")
    : [];
  const expectedResponses = selectedRun
    ? selectedRun.prompt_snapshots.length * candidateSnapshots.length
    : 0;
  const completedCandidateResponses = effectiveResponses.filter(
    (item) => item.status === "completed",
  ).length;
  const allCandidatesReady =
    expectedResponses > 0 &&
    effectiveResponses.length === expectedResponses &&
    completedCandidateResponses === expectedResponses;
  const absoluteBatches = judging?.items.filter((b) => b.batch_type === "absolute") ?? [];
  const allAbsoluteComplete =
    absoluteBatches.length > 0 && absoluteBatches.every(isJudgeBatchCompleted);
  const judgingReady =
    allCandidatesReady &&
    !!judging &&
    judging.total_batches > 0 &&
    allAbsoluteComplete;
  const phase1Progress =
    expectedResponses > 0 ? completedCandidateResponses / expectedResponses : 0;
  const phase2Progress =
    judging && judging.total_batches > 0
      ? judging.completed_batches / judging.total_batches
      : 0;
  const phase3Progress = selectedRun
    ? selectedRun.report_status === "completed"
      ? 1
      : selectedRun.global_summaries.length > 0 || selectedRun.status === "reporting"
        ? 0.65
        : 0
    : 0;
  const loadError =
    (runQuery.error instanceof ApiError && runQuery.error.message) ||
    (responsesQuery.error instanceof ApiError && responsesQuery.error.message) ||
    (localNextQuery.error instanceof ApiError && localNextQuery.error.message) ||
    (judgingQuery.error instanceof ApiError && judgingQuery.error.message) ||
    null;
  const retryLoad = () => {
    void Promise.all([
      runQuery.refetch(),
      responsesQuery.refetch(),
      localNextQuery.refetch(),
      judgingQuery.refetch(),
    ]);
  };

  const openResponseInspector = (responseId: number) => {
    setSelectedResponseId(responseId);
    setIsResponseModalOpen(true);
  };

  const openJudgeInspector = (batchId: number) => {
    setSelectedJudgeBatchId(batchId);
    setIsJudgeModalOpen(true);
  };

  return (
    <div className="px-5 py-3 lg:px-10 lg:py-4">
      <div className="mb-2">
        <Button className="h-8 px-2" onClick={onBack} variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to runs
        </Button>
      </div>

      {selectedRun ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-[hsl(var(--surface-overlay))] shadow-[0_24px_70px_-40px_rgba(15,23,42,0.16)]">
            <header className="border-b border-border/40 px-6 pb-5 pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.28em] text-primary/80">
                    Run #{selectedRun.id}
                  </p>
                  <h2 className="truncate text-[2rem] font-semibold tracking-tight text-foreground">
                    {selectedRun.name}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-1 text-[0.78rem] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={selectedRun.status} />
                    </div>
                    <span className="mx-1.5 text-border/60">·</span>
                    <div className="flex items-center gap-1.5">
                      <span>
                        <span className="font-semibold text-foreground">{selectedRun.prompt_snapshots.length}</span> scénarios
                      </span>
                    </div>
                    <span className="mx-1.5 text-border/60">·</span>
                    <div className="flex items-center gap-1.5">
                      <span>
                        <span className="font-semibold text-foreground">
                          {selectedRun.model_snapshots.filter((item) => item.role === "candidate").length}
                        </span>{" "}
                        candidates
                      </span>
                    </div>
                    <span className="mx-1.5 text-border/60">·</span>
                    <div className="flex items-center gap-1.5">
                      <span>
                        <span className="font-semibold text-foreground">
                          {selectedRun.model_snapshots.filter((item) => item.role === "judge").length}
                        </span>{" "}
                        juges
                      </span>
                    </div>
                    <span className="mx-1.5 text-border/60">·</span>
                    <div className="flex items-center gap-1.5">
                      <span>
                        <span className="font-semibold text-foreground">{selectedRun.candidate_response_count}</span> réponses
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                      {selectedRun.rubric_version}
                    </Badge>
                    <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                      {formatDate(selectedRun.launched_at)}
                    </Badge>
                    <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                      {selectedRun.report_status === "completed" ? "report ready" : selectedRun.report_status}
                    </Badge>
                  </div>
                </div>

              </div>
            </header>

            {loadError ? (
              <div className="px-6 py-4">
                <LoadErrorState
                  compact
                  message={loadError}
                  onRetry={retryLoad}
                  resourceLabel="this run"
                />
              </div>
            ) : null}

            {feedback ? (
              isServiceAvailabilityError(feedback) ? (
                <div className="mt-5">
                  <LoadErrorState
                    compact
                    message={feedback}
                    onRetry={retryLoad}
                    resourceLabel="run operations"
                  />
                </div>
              ) : (
                <div className="border-t border-primary/20 bg-primary/5 px-6 py-3 text-[0.82rem] text-primary">
                  {feedback}
                </div>
              )
            ) : null}
          </div>

          <RunPhaseSwitcher
            activePhase={activePhase}
            onPhaseChange={setActivePhase}
            phase1Progress={phase1Progress}
            phase2Progress={phase2Progress}
            phase3Progress={phase3Progress}
            phase2Unlocked={allCandidatesReady}
            phase3Unlocked={judgingReady || selectedRun.report_status === "completed"}
          />

          {activePhase === "phase1" ? (
            <div className="space-y-6">
              <Card className="border-border/70 bg-[hsl(var(--surface-overlay))] p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <SectionHeading
                    title="Phase 1 · Candidate Execution"
                    description=""
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryStat label="Candidates" value={String(candidateSnapshots.length)} />
                    <SummaryStat label="Expected Responses" value={String(expectedResponses)} />
                    <SummaryStat
                      label="Completed Responses"
                      value={`${completedCandidateResponses}/${expectedResponses}`}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-col divide-y divide-border/60">
                  {responsesQuery.isLoading ? (
                    <p className="py-6 text-[0.86rem] text-[hsl(var(--foreground-soft))]">Loading candidate responses...</p>
                  ) : (
                    candidateSnapshots.map((candidate) => {
                      const candidateResponses = effectiveResponses.filter(
                        (r) => r.model_snapshot_id === candidate.id,
                      );
                      const promptCount = selectedRun.prompt_snapshots.length;
                      const completedCount = candidateResponses.filter((r) => r.status === "completed").length;
                      const runningCount = candidateResponses.filter((r) => r.status === "running").length;
                      const failedCount = candidateResponses.filter((r) => ["failed", "cancelled"].includes(r.status)).length;
                      const pendingCount = candidateResponses.filter((r) => ["pending", "pending_local"].includes(r.status)).length;
                      const isLocal = candidate.runtime_type === "local";
                      const localState = localNextQuery.data;
                      const isCurrentLocal = localState?.model_snapshot_id === candidate.id;
                      const pct = promptCount > 0 ? Math.round((completedCount / promptCount) * 100) : 0;

                      return (
                        <div key={candidate.id} className="py-3 first:pt-0 last:pb-0">
                          {/* Model header row */}
                          <div className="flex items-center gap-2 px-1">
                            <p className="shrink-0 text-[0.88rem] font-semibold text-foreground">{candidate.display_name}</p>
                            <span className="shrink-0 rounded-full bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-[0.65rem] text-[hsl(var(--foreground-soft))]">
                              {candidate.provider_type} / {candidate.runtime_type}
                            </span>
                            {failedCount > 0 && (
                              <span className="shrink-0 text-[0.65rem] font-medium text-rose-500">{failedCount} failed</span>
                            )}
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <div className="h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    pct === 100 ? "bg-emerald-500" : runningCount > 0 ? "bg-amber-400" : "bg-slate-300",
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="shrink-0 text-[0.7rem] tabular-nums text-[hsl(var(--foreground-soft))]">
                                {completedCount}/{promptCount}
                              </span>
                            </div>

                            {isLocal && isCurrentLocal ? (
                              <div className="flex shrink-0 gap-1.5">
                                <Button
                                  className="h-7 px-3 text-[0.75rem]"
                                  disabled={confirmLocalMutation.isPending}
                                  onClick={() => confirmLocalMutation.mutate()}
                                  size="sm"
                                  variant="secondary"
                                >
                                  Ready
                                </Button>
                                <Button
                                  className="h-7 px-3 text-[0.75rem]"
                                  disabled={!localState?.confirmed_ready || startLocalMutation.isPending}
                                  onClick={() => startLocalMutation.mutate()}
                                  size="sm"
                                >
                                  {startLocalMutation.isPending ? "Starting..." : "Start"}
                                </Button>
                              </div>
                            ) : !isLocal ? (
                              <Button
                                className="h-7 shrink-0 px-3 text-[0.75rem]"
                                disabled={startingRemoteIds.includes(candidate.id) || completedCount === promptCount}
                                onClick={() => handleStartRemoteCandidate(candidate.id)}
                                size="sm"
                                variant="secondary"
                              >
                                {completedCount === promptCount ? "Completed" : startingRemoteIds.includes(candidate.id) ? "Starting..." : "Start"}
                              </Button>
                            ) : null}
                          </div>

                          {/* Prompt response cards grid */}
                          {candidateResponses.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-1.5 px-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                              {candidateResponses.map((response) => {
                                const prompt = promptById(selectedRun.prompt_snapshots, response.prompt_snapshot_id);
                                const isCardLoading =
                                  retryingResponseIds.includes(response.id) ||
                                  response.status === "pending" ||
                                  response.status === "running";

                                return (
                                  <div
                                    key={response.id}
                                    className={cn(
                                      "group/card relative cursor-pointer rounded-md border border-border/60 bg-[hsl(var(--surface-muted))] px-2 py-1.5 transition hover:border-border hover:bg-[hsl(var(--surface-overlay))]",
                                      selectedResponseId === response.id && "border-border bg-[hsl(var(--surface-overlay))] ring-1 ring-inset ring-border",
                                    )}
                                    onClick={() => openResponseInspector(response.id)}
                                  >
                                    {/* Prompt name + status badge */}
                                    <div className="flex items-baseline justify-between gap-1">
                                      <p className="truncate text-[0.72rem] font-semibold leading-tight text-foreground">
                                        {prompt?.name ?? "Unknown"}
                                      </p>
                                      <div className="group/failed relative shrink-0">
                                        <span
                                          className={cn(
                                            "inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-[0.1rem] text-[0.58rem] font-semibold capitalize",
                                            response.status === "completed" && "bg-emerald-100 text-emerald-900",
                                            ["running", "running_candidates", "waiting_local", "ready_for_judging", "judging", "aggregating", "reporting"].includes(response.status) && "bg-amber-100 text-amber-900",
                                            ["failed", "cancelled"].includes(response.status) && "bg-rose-100 text-rose-900",
                                            ["pending", "pending_local"].includes(response.status) && "bg-slate-100 text-slate-700",
                                          )}
                                        >
                                          {isCardLoading && <LoaderCircle className="mr-0.5 h-2 w-2 animate-spin" />}
                                          {response.status.replaceAll("_", " ")}
                                        </span>
                                        {response.status === "failed" && response.error_message ? (
                                          <div className="pointer-events-none absolute right-0 top-full z-30 hidden w-[22rem] pt-2 group-hover/failed:block">
                                            <div className="overflow-hidden rounded-2xl border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.96))] shadow-[0_24px_60px_-28px_rgba(225,29,72,0.45)] backdrop-blur-sm">
                                              <div className="border-b border-rose-200/70 px-3 py-2">
                                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-rose-700">Execution Error</p>
                                              </div>
                                              <div className="px-3 py-2.5">
                                                <p className="text-[0.75rem] leading-5 text-slate-700">{response.error_message}</p>
                                              </div>
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>

                                    {/* Metrics — single line, no wrap */}
                                    <div className="mt-1 flex items-center gap-x-1.5 overflow-hidden text-[0.63rem] text-[hsl(var(--foreground-soft))]">
                                      <span className="flex shrink-0 items-center gap-0.5">
                                        <Clock3 className="h-2 w-2 shrink-0 text-sky-400" />
                                        {formatDuration(response.metric?.duration_ms)}
                                      </span>
                                      <span className="shrink-0">T{response.metric?.total_tokens ?? "—"}</span>
                                      <span className="flex shrink-0 items-center gap-0.5">
                                        <DollarSign className="h-2 w-2 shrink-0 text-emerald-400" />
                                        {formatCost(response.metric?.estimated_cost)}
                                      </span>
                                      {(response.retry_count ?? 0) > 0 && (
                                        <span className="flex shrink-0 items-center gap-0.5">
                                          <RefreshCw className="h-2 w-2 shrink-0 text-amber-400" />
                                          {response.retry_count}
                                        </span>
                                      )}
                                    </div>

                                    {/* Retry button */}
                                    {["failed", "cancelled"].includes(response.status) && (
                                      <Button
                                        className="mt-1 h-4 w-full px-1.5 text-[0.6rem]"
                                        disabled={retryingResponseIds.includes(response.id)}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleRetryResponse(response.id);
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="secondary"
                                      >
                                        Retry
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          ) : null}

          {activePhase === "phase2" ? (
            <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
              <SectionHeading
                title="Phase 2 · Judging"
                description="Cette phase se déverrouille uniquement quand tous les candidats ont fini tous les scénarios."
              />
              {!allCandidatesReady ? (
                <div className="mt-5">
                  <LockedPhasePanel
                    title="Phase 2 locked"
                    description={`Candidate execution must finish first. ${completedCandidateResponses}/${expectedResponses} candidate responses are completed.`}
                  />
                </div>
              ) : (
                <div className="mt-5 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                  <div>
                    <JudgeBatchPanel
                      isClearing={clearJudgingMutation.isPending}
                      isLoading={judgingQuery.isLoading}
                      isRestarting={restartJudgingMutation.isPending}
                      isStarting={startJudgingMutation.isPending}
                      isRetrying={retryJudgingMutation.isPending}
                      onClear={() => clearJudgingMutation.mutate()}
                      onRestart={() => restartJudgingMutation.mutate()}
                      canStart={allCandidatesReady && (!judging || judging.items.length === 0)}
                      judging={judging}
                      onStart={() => startJudgingMutation.mutate()}
                      onRetry={() => retryJudgingMutation.mutate()}
                      promptSnapshots={selectedRun.prompt_snapshots}
                      selectedPromptId={selectedJudgingPromptId}
                      onSelectPrompt={setSelectedJudgingPromptId}
                    />
                  </div>
                  <div>
                    <PromptJudgeResultsPanel
                      promptId={selectedJudgingPromptId}
                      promptSnapshots={selectedRun.prompt_snapshots}
                      judging={judging}
                      modelSnapshots={selectedRun.model_snapshots}
                      responses={rawResponses}
                      run={selectedRun}
                      retryingBatchIds={retryingBatchIds}
                      isJudgingActive={retryJudgingMutation.isPending || clearJudgingMutation.isPending || restartJudgingMutation.isPending || startJudgingMutation.isPending || retryingBatchIds.length > 0}
                      onInspectBatch={(batchId) => { setSelectedJudgeBatchId(batchId); openJudgeInspector(batchId); }}
                      onRetryBatch={handleRetryBatch}
                      onSelectResponse={(responseId) => openResponseInspector(responseId)}
                    />
                  </div>
                </div>
              )}
            </Card>
          ) : null}

          {activePhase === "phase3" ? (
            <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
              <SectionHeading
                title="Phase 3 · Aggregation And Report"
                description=""
              />
              {!judgingReady && selectedRun.report_status !== "completed" ? (
                <div className="mt-5">
                  <LockedPhasePanel
                    title="Phase 3 locked"
                    description="All absolute judging batches must complete before report generation is available. Arena failures are ignored."
                  />
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <button
                      disabled={downloadHtmlMutation.isPending}
                      onClick={() => downloadHtmlMutation.mutate()}
                      className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-border hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {downloadHtmlMutation.isPending ? (
                        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <FileCode className="h-6 w-6 text-sky-500 transition-transform group-hover:scale-110" />
                      )}
                      <span className="text-sm font-medium text-foreground">Generate HTML</span>
                    </button>

                    <button
                      disabled={downloadPdfMutation.isPending}
                      onClick={() => downloadPdfMutation.mutate()}
                      className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-border hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {downloadPdfMutation.isPending ? (
                        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <FileText className="h-6 w-6 text-rose-500 transition-transform group-hover:scale-110" />
                      )}
                      <span className="text-sm font-medium text-foreground">Generate PDF</span>
                    </button>

                    <button
                      disabled={downloadSummarySvgMutation.isPending}
                      onClick={() => downloadSummarySvgMutation.mutate()}
                      className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-border hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {downloadSummarySvgMutation.isPending ? (
                        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <FileImage className="h-6 w-6 text-violet-500 transition-transform group-hover:scale-110" />
                      )}
                      <span className="text-sm font-medium text-foreground">Export SVG</span>
                    </button>

                    <button
                      disabled={generateAllMutation.isPending}
                      onClick={() => generateAllMutation.mutate()}
                      className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-border hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {generateAllMutation.isPending ? (
                        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Download className="h-6 w-6 text-emerald-500 transition-transform group-hover:scale-110" />
                      )}
                      <span className="text-sm font-medium text-foreground">Generate All</span>
                    </button>
                  </div>
                  <PromptRankingMatrix
                    judging={judging}
                    responses={rawResponses}
                    run={selectedRun}
                  />
                  <CostRecapPanel run={selectedRun} judging={judging} responses={rawResponses} />
                  <AggregatedSummaryTable run={selectedRun} />
                  <PassAtKSummaryTable run={selectedRun} />
                </div>
              )}
            </Card>
          ) : null}
        </div>
      ) : runQuery.isLoading ? (
        <Card className="border-border/70 bg-[hsl(var(--surface-overlay))] p-6 shadow-sm">
          <p className="text-sm text-[hsl(var(--foreground-soft))]">Loading run details...</p>
        </Card>
      ) : (
        <Card className="border-border/70 bg-[hsl(var(--surface-overlay))] p-6 shadow-sm">
          <EmptyStatePanel
            title="Run not found"
            description="The requested run could not be loaded from the API."
          />
        </Card>
      )}

      <Modal
        description="Inspection détaillée de la réponse sélectionnée, avec le payload, le texte normalisé et les métriques d'exécution."
        onClose={() => setIsResponseModalOpen(false)}
        open={isResponseModalOpen && selectedResponse !== null}
        size="xxl"
        tone="sky"
        title={
          selectedResponse
            ? `Selected Response · ${
                promptById(selectedRun?.prompt_snapshots ?? [], selectedResponse.prompt_snapshot_id)?.name ??
                "Unknown scenario"
              }`
            : "Selected Response"
        }
      >
        {selectedResponse && selectedRun ? (
          <ResponseInspector
            model={modelById(
              selectedRun.model_snapshots,
              selectedResponse.model_snapshot_id,
            )}
            prompt={promptById(
              selectedRun.prompt_snapshots,
              selectedResponse.prompt_snapshot_id,
            )}
            response={selectedResponse}
          />
        ) : null}
      </Modal>

      <Modal
        description="Inspection détaillée du job de jugement sélectionné, avec le scénario, le payload, la réponse brute et le JSON parsé."
        onClose={() => setIsJudgeModalOpen(false)}
        open={isJudgeModalOpen && selectedJudgeBatch !== null && selectedRun !== undefined}
        size="xxl"
        tone="amber"
        title={
          selectedJudgeBatch
            ? `Judge Job · ${
                promptById(selectedRun?.prompt_snapshots ?? [], selectedJudgeBatch.prompt_snapshot_id)
                  ?.name ?? "Unknown scenario"
              }`
            : "Judge Job"
        }
      >
        {selectedJudgeBatch && selectedRun ? (
          <JudgeInspector
            batch={selectedJudgeBatch}
            judgeModel={modelById(selectedRun.model_snapshots, selectedJudgeBatch.judge_model_snapshot_id)}
            prompt={promptById(selectedRun.prompt_snapshots, selectedJudgeBatch.prompt_snapshot_id)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function InfoTag({
  tone,
  value,
}: {
  tone: "slate" | "sky" | "amber" | "emerald" | "rose";
  value: string;
}) {
  const toneClasses = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      <span className="normal-case tracking-normal">{value}</span>
    </span>
  );
}

function RunPhaseSwitcher({
  activePhase,
  onPhaseChange,
  phase1Progress,
  phase2Progress,
  phase3Progress,
  phase2Unlocked,
  phase3Unlocked,
}: {
  activePhase: RunPhaseKey;
  onPhaseChange: (phase: RunPhaseKey) => void;
  phase1Progress: number;
  phase2Progress: number;
  phase3Progress: number;
  phase2Unlocked: boolean;
  phase3Unlocked: boolean;
}) {
  const phases = [
    {
      key: "phase1" as const,
      label: "Phase 1",
      subtitle: "Candidates",
      icon: SquareTerminal,
      progress: phase1Progress,
      unlocked: true,
      iconClass: "bg-primary/10 text-primary",
    },
    {
      key: "phase2" as const,
      label: "Phase 2",
      subtitle: "Judging",
      icon: Gavel,
      progress: phase2Progress,
      unlocked: phase2Unlocked,
      iconClass: "bg-primary/10 text-primary",
    },
    {
      key: "phase3" as const,
      label: "Phase 3",
      subtitle: "Report",
      icon: Sparkles,
      progress: phase3Progress,
      unlocked: phase3Unlocked,
      iconClass: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {phases.map((phase) => {
        const Icon = phase.icon;
        const isActive = phase.key === activePhase;
        const progressWidth = `${Math.max(0, Math.min(phase.progress, 1)) * 100}%`;

        return (
          <button
            key={phase.key}
            className={cn(
              "group relative overflow-hidden rounded-[1.25rem] border text-left transition duration-200",
              isActive
                ? "border-primary/30 bg-primary/8 shadow-[0_22px_48px_-28px_rgba(15,23,42,0.18)]"
                : "border-border/60 bg-[hsl(var(--surface-overlay))] hover:bg-[hsl(var(--surface))]",
              !phase.unlocked && "opacity-70",
            )}
            disabled={!phase.unlocked}
            onClick={() => onPhaseChange(phase.key)}
            type="button"
          >
            <div className="absolute inset-x-4 bottom-3 h-[4px] overflow-hidden rounded-full bg-border/60">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  isActive ? "bg-primary" : "bg-primary/50",
                )}
                style={{ width: progressWidth }}
              />
            </div>

            <div className="relative flex items-start justify-between gap-3 px-4 py-3 pb-7">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm",
                    phase.iconClass,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[0.95rem] font-semibold leading-none text-foreground",
                    )}
                  >
                    {phase.label}
                  </p>
                  <p className="mt-1 text-[0.8rem] leading-none text-muted-foreground">{phase.subtitle}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-[hsl(var(--surface-muted))] text-muted-foreground",
                  )}
                >
                  {!phase.unlocked ? "Locked" : isActive ? "Current" : "Open"}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LockedPhasePanel({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-950">{title}</p>
      <p className="mt-2 text-sm text-amber-900">{description}</p>
    </div>
  );
}

function CandidateExecutionCard({
  candidate,
  isConfirming,
  isStartingEndpoint,
  isStarting,
  localState,
  onConfirmReady,
  onStartEndpoint,
  onStartCurrent,
  promptCount,
  responses,
  runStatus,
}: {
  candidate: RunModelSnapshot;
  isConfirming: boolean;
  isStartingEndpoint: boolean;
  isStarting: boolean;
  localState: LocalExecutionNextResponse | null | undefined;
  onConfirmReady: () => void;
  onStartEndpoint: () => void;
  onStartCurrent: () => void;
  promptCount: number;
  responses: CandidateResponse[];
  runStatus: string;
}) {
  const completedCount = responses.filter((item) => item.status === "completed").length;
  const runningCount = responses.filter((item) => item.status === "running").length;
  const failedCount = responses.filter((item) =>
    ["failed", "cancelled"].includes(item.status),
  ).length;
  const pendingCount = responses.filter((item) =>
    ["pending", "pending_local"].includes(item.status),
  ).length;
  const isLocal = candidate.runtime_type === "local";
  const remainingCount = isLocal ? pendingCount + failedCount : pendingCount;
  const isCurrentLocal = localState?.model_snapshot_id === candidate.id;
  const completionRatio = promptCount > 0 ? completedCount / promptCount : 0;
  const startedCount = responses.filter(
    (item) => item.retry_count > 0 || item.status !== "pending",
  ).length;
  const candidateStatus = (() => {
    if (completedCount === promptCount && promptCount > 0) {
      return { status: "completed", label: "candidate ready" };
    }
    if (runningCount > 0) {
      return {
        status: "running",
        label: isLocal ? "running local scenarios" : "running endpoint scenarios",
      };
    }
    if (isLocal && isCurrentLocal && localState && !localState.confirmed_ready) {
      return { status: "pending_local", label: "awaiting local load" };
    }
    if (isLocal && remainingCount > 0) {
      return { status: "pending", label: isCurrentLocal ? "ready to start" : "queued local handoff" };
    }
    if (!isLocal && failedCount > 0 && pendingCount === 0) {
      return { status: "failed", label: "endpoint failed" };
    }
    if (!isLocal && startedCount > 0 && pendingCount > 0) {
      return { status: "running", label: "endpoint in progress" };
    }
    if (!isLocal) {
      if (failedCount > 0) {
        return { status: "failed", label: "endpoint failed" };
      }
      return { status: "pending", label: "ready to launch" };
    }
    return { status: runStatus, label: undefined };
  })();

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[1.35rem] border border-border/80 bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(255,255,255,0.98))] p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_-26px_rgba(15,23,42,0.35)]">
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 rounded-t-[1.35rem] bg-gradient-to-r",
            isLocal
              ? "from-emerald-300 via-emerald-200 to-emerald-100"
              : "from-sky-300 via-slate-200 to-slate-100",
          )}
          style={{ width: `${Math.max(completionRatio * 100, 14)}%` }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {candidate.display_name}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {candidate.provider_type} / {candidate.runtime_type}
            </p>
          </div>
          <MetaPill label={isLocal ? "Local" : "Endpoint"} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <StatusPill status={candidateStatus.status} label={candidateStatus.label} />
          <div className="text-right">
            <p className="text-lg font-semibold text-slate-950">
              {completedCount}/{promptCount}
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">done</p>
          </div>
        </div>

        {isLocal && isCurrentLocal ? (
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1"
              disabled={isConfirming}
              onClick={onConfirmReady}
              size="sm"
              variant="secondary"
            >
              Ready
            </Button>
            <Button
              className="flex-1"
              disabled={!localState?.confirmed_ready || isStarting}
              onClick={onStartCurrent}
              size="sm"
            >
              {isStarting ? "Starting..." : "Start"}
            </Button>
          </div>
        ) : !isLocal ? (
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1"
              disabled={isStartingEndpoint || completedCount === promptCount}
              onClick={onStartEndpoint}
              size="sm"
              variant="secondary"
            >
              {completedCount === promptCount ? "Completed" : isStartingEndpoint ? "Starting..." : "Start"}
            </Button>
          </div>
        ) : null}

        {failedCount > 0 ? (
          <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-rose-500">
            {isLocal ? `${failedCount} to retry` : `${failedCount} failed`}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getTopRunListSummaries(run: Run, limit: number): RunGlobalSummary[] {
  return [...run.global_summaries]
    .sort(
    (a, b) => Number(b.final_global_score ?? "-1") - Number(a.final_global_score ?? "-1"),
    )
    .slice(0, limit);
}

function formatRunListDateTimeShort(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRunListElapsed(startedAt: string, completedAt: string): string {
  const diffMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return "durée indisponible";
  }

  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

function formatRunListLatency(value: number | null): string {
  if (value === null) {
    return "latence —";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} s`;
  }
  return `${value} ms`;
}

function formatRunListCost(value: string | null): string {
  if (!value) {
    return "coût —";
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return `coût ${value}`;
  }
  return `coût $${numericValue.toFixed(3)}`;
}

function formatRunListScore(value: string | null): string {
  if (!value) {
    return "—";
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  return numericValue.toFixed(2);
}

function RunTopThreeSummary({
  run,
  summaries,
}: {
  run: Run;
  summaries: RunGlobalSummary[];
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      {summaries.map((summary, index) => {
        const model = run.model_snapshots.find((item) => item.id === summary.model_snapshot_id);
        const rank = index + 1;
        return (
          <div
            key={summary.id}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2 py-1",
              rank === 1
                ? "border-primary/20 bg-primary/6"
                : "border-border/50 bg-[hsl(var(--surface))]",
            )}
          >
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.58rem] font-bold",
                rank === 1 && "bg-amber-100 text-amber-700",
                rank === 2 && "bg-slate-100 text-slate-600",
                rank === 3 && "bg-orange-100 text-orange-700",
              )}
            >
              {rank === 1 ? <Award className="h-2.5 w-2.5" /> : rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[0.74rem] font-medium text-foreground">
                  {model?.display_name ?? `Modèle ${rank}`}
                </p>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.64rem] text-muted-foreground">
                <span>
                  score <span className="font-semibold text-foreground">{formatRunListScore(summary.final_global_score)}</span>
                </span>
                {rank === 1 ? (
                  <>
                    <span className="text-border/60">·</span>
                    <span>{formatRunListLatency(summary.avg_duration_ms)}</span>
                    <span className="text-border/60">·</span>
                    <span>{formatRunListCost(summary.total_estimated_cost)}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RunsTableEmptyRow({ message }: { message: string }) {
  return (
    <tr className="border-t border-border/30">
      <td className="px-5 py-12 text-center text-sm text-muted-foreground/50" colSpan={5}>
        {message}
      </td>
    </tr>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-slate-50 px-3 py-2">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {label}
    </span>
  );
}

function StatusPill({ label, status, title }: { label?: string; status: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize",
        status === "completed" && "bg-emerald-100 text-emerald-900",
        ["running", "running_candidates", "waiting_local", "ready_for_judging", "judging", "aggregating", "reporting"].includes(status) &&
          "bg-amber-100 text-amber-900",
        ["failed", "cancelled"].includes(status) && "bg-rose-100 text-rose-900",
        ["pending", "pending_local"].includes(status) && "bg-slate-100 text-slate-700",
      )}
    >
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

function ResponseInspector({
  model,
  prompt,
  response,
}: {
  model: RunModelSnapshot | undefined;
  prompt: RunPromptSnapshot | undefined;
  response: CandidateResponse;
}) {
  const normalizedResponse = formatInspectorContent(response.normalized_response_text);
  const rawResponse =
    formatInspectorContent(response.raw_response_jsonb) ??
    formatInspectorContent(response.raw_response_text);
  const requestPayload = formatInspectorContent(response.request_payload_jsonb);
  const hasExecutionMetrics = Boolean(
    response.metric?.duration_ms !== null ||
      response.metric?.total_tokens !== null ||
      response.metric?.tokens_per_second ||
      response.metric?.estimated_cost,
  );

  return (
    <div className="mt-2 space-y-5 text-sm text-slate-900">
      <div className="grid gap-3 lg:grid-cols-4">
        <SummaryStat label="Scenario" value={prompt?.name ?? "Unknown scenario"} />
        <SummaryStat label="Candidate" value={model?.display_name ?? "Unknown model"} />
        <SummaryStat label="Status" value={response.status.replaceAll("_", " ")} />
        <SummaryStat
          label="Completed"
          value={formatDateTime(response.completed_at) ?? "In progress"}
        />
      </div>

      {response.error_message ? (
        <InspectorPanel accent="rose" title="Execution Error">
          <CodeBlock content={response.error_message} tone="rose" />
        </InspectorPanel>
      ) : null}

      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
          <div className="space-y-5">
            <InspectorPanel
              accent="sky"
              eyebrow="Scenario"
              title={prompt?.name ?? "Unknown scenario"}
              subtitle="Snapshot de scénario utilisé pour cette réponse."
            >
              {prompt?.system_prompt_text ? (
                <PromptBlock label="System instruction" text={prompt.system_prompt_text} />
              ) : null}
              <PromptBlock
                label="Rendered scenario"
                text={prompt?.user_prompt_text ?? "No scenario text recorded."}
              />
              {prompt?.evaluation_notes ? (
                <PromptBlock label="Evaluation Notes" text={prompt.evaluation_notes} />
              ) : null}
            </InspectorPanel>

            <InspectorPanel
              accent="slate"
              eyebrow="Request"
              title="Request Payload"
              subtitle="Payload envoyé au provider pour cette exécution."
            >
              <CodeBlock
                content={requestPayload?.content ?? "No payload persisted yet."}
                isJson={requestPayload?.isJson}
              />
            </InspectorPanel>
          </div>

          <div className="space-y-5">
            <InspectorPanel
              accent="amber"
              eyebrow="Answer"
              title="Normalized Response"
              subtitle="Version directe et exploitable de la réponse du modèle."
            >
              <CodeBlock
                content={normalizedResponse?.content ?? "No normalized response recorded yet."}
                isJson={normalizedResponse?.isJson}
                tone="amber"
              />
            </InspectorPanel>

            <InspectorPanel
              accent="slate"
              eyebrow="Raw Output"
              title="Raw Response"
              subtitle="Réponse complète brute, formatée automatiquement si du JSON est disponible."
            >
              <CodeBlock
                content={rawResponse?.content ?? "No raw response persisted yet."}
                isJson={rawResponse?.isJson}
              />
            </InspectorPanel>
          </div>
        </div>

        {hasExecutionMetrics ? (
          <InspectorPanel
            accent="emerald"
            eyebrow="Metrics"
            title="Execution Metrics"
            subtitle="Mesures enregistrées pendant l'appel modèle."
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <MetricTile
                label="Duration"
                value={formatInspectorDuration(response.metric?.duration_ms)}
              />
              <MetricTile
                label="Tokens"
                value={formatInteger(response.metric?.total_tokens)}
              />
              <MetricTile
                label="Input Tokens"
                value={formatInteger(response.metric?.input_tokens)}
              />
              <MetricTile
                label="Output Tokens"
                value={formatInteger(response.metric?.output_tokens)}
              />
              <MetricTile
                label="Tokens / Second"
                value={formatTokensPerSecond(response.metric?.tokens_per_second)}
              />
              <MetricTile
                label="Estimated Cost"
                value={response.metric?.estimated_cost ?? "—"}
              />
            </div>
          </InspectorPanel>
        ) : null}
      </div>
    </div>
  );
}

function JudgeInspector({
  batch,
  judgeModel,
  prompt,
}: {
  batch: JudgeBatch;
  judgeModel: RunModelSnapshot | undefined;
  prompt: RunPromptSnapshot | undefined;
}) {
  const requestPayload = formatInspectorContent(batch.request_payload_jsonb);
  const rawResponse =
    formatInspectorContent(batch.raw_response_jsonb) ??
    formatInspectorContent(batch.raw_response_text);
  const parsedEvaluation = formatInspectorContent(batch.evaluation?.parsed_output_jsonb);

  return (
    <div className="mt-2 space-y-5 text-sm text-slate-900">
      <div className="grid gap-3 lg:grid-cols-5">
        <SummaryStat label="Scenario" value={prompt?.name ?? "Unknown scenario"} />
        <SummaryStat label="Judge Model" value={judgeModel?.display_name ?? "Unknown model"} />
        <SummaryStat label="Job Type" value={batch.batch_type} />
        <SummaryStat label="Status" value={batch.status.replaceAll("_", " ")} />
        <SummaryStat label="Completed" value={formatDateTime(batch.completed_at) ?? "Pending"} />
      </div>

      {batch.error_message ? (
        <InspectorPanel accent="rose" title="Judge Error">
          <CodeBlock content={batch.error_message} tone="rose" />
        </InspectorPanel>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <div className="space-y-5">
          <InspectorPanel
            accent="sky"
            eyebrow="Scenario"
            title={prompt?.name ?? "Unknown scenario"}
            subtitle="Snapshot évalué par le juge pour ce job."
          >
            {prompt?.system_prompt_text ? (
              <PromptBlock label="System instruction" text={prompt.system_prompt_text} />
            ) : null}
            <PromptBlock
              label="Rendered scenario"
              text={prompt?.user_prompt_text ?? "No scenario text recorded."}
            />
            {prompt?.evaluation_notes ? (
              <PromptBlock label="Evaluation Notes" text={prompt.evaluation_notes} />
            ) : null}
          </InspectorPanel>

          <InspectorPanel
            accent="slate"
            eyebrow="Request"
            title="Judge Request Payload"
            subtitle="Payload envoyé au modèle juge."
          >
            <CodeBlock
              content={requestPayload?.content ?? "No request payload persisted yet."}
              isJson={requestPayload?.isJson}
            />
          </InspectorPanel>
        </div>

        <div className="space-y-5">
          <InspectorPanel
            accent="amber"
            eyebrow="Output"
            title="Parsed Judge Evaluation"
            subtitle="JSON évalué et persisté après parsing."
          >
            <CodeBlock
              content={parsedEvaluation?.content ?? "No parsed evaluation persisted yet."}
              isJson={parsedEvaluation?.isJson}
              tone="amber"
            />
          </InspectorPanel>

          <InspectorPanel
            accent="slate"
            eyebrow="Raw Output"
            title="Raw Judge Response"
            subtitle="Réponse brute complète du modèle juge."
          >
            <CodeBlock
              content={rawResponse?.content ?? "No raw response persisted yet."}
              isJson={rawResponse?.isJson}
            />
          </InspectorPanel>
        </div>
      </div>
    </div>
  );
}

function InspectorPanel({
  accent = "slate",
  children,
  eyebrow,
  subtitle,
  title,
}: {
  accent?: "amber" | "emerald" | "rose" | "sky" | "slate";
  children: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
}) {
  const accentClasses = {
    amber: "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]",
    emerald:
      "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))]",
    rose: "border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.98))]",
    sky: "border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.96),rgba(255,255,255,0.98))]",
    slate:
      "border-border/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))]",
  } as const;

  const eyebrowClasses = {
    amber: "bg-amber-100 text-amber-900",
    emerald: "bg-emerald-100 text-emerald-900",
    rose: "bg-rose-100 text-rose-900",
    sky: "bg-sky-100 text-sky-900",
    slate: "bg-slate-100 text-slate-700",
  } as const;

  return (
    <section className={cn("rounded-[1.4rem] border p-4 shadow-sm", accentClasses[accent])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                eyebrowClasses[accent],
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h3 className="mt-2 text-base font-semibold tracking-tight text-slate-950">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-[12px] leading-5 text-slate-600">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-[1.1rem] border border-slate-200/90 bg-white/90 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <pre className="mt-2 max-h-[18rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950/[0.03] px-3 py-3 text-[12px] leading-5 text-slate-800">
        {text}
      </pre>
    </div>
  );
}

function CodeBlock({
  content,
  isJson = false,
  tone = "slate",
}: {
  content: string;
  isJson?: boolean;
  tone?: "amber" | "rose" | "slate";
}) {
  const toneClasses = {
    amber: "border-amber-200/80 bg-amber-950/[0.03] text-slate-900",
    rose: "border-rose-200/80 bg-rose-950/[0.03] text-rose-950",
    slate: "border-slate-200/90 bg-slate-950/[0.03] text-slate-900",
  } as const;

  return (
    <div className={cn("rounded-[1.1rem] border", toneClasses[tone])}>
      <div className="flex items-center justify-between border-b border-inherit px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {isJson ? "Pretty JSON" : "Text"}
        </p>
      </div>
      <pre className="max-h-[32rem] overflow-auto px-3 py-3 font-mono text-[12px] leading-5 whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-emerald-200/80 bg-white/85 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-medium text-slate-900">{value}</p>
    </div>
  );
}

function formatInspectorContent(
  value: string | null | undefined,
): { content: string; isJson: boolean } | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    return {
      content: JSON.stringify(parsed, null, 2),
      isJson: true,
    };
  } catch {
    return {
      content: value,
      isJson: false,
    };
  }
}

function formatInspectorDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatTokensPerSecond(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(parsed);
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildOptimisticJudging(run: Run): RunJudging {
  const items = [...run.prompt_snapshots]
    .sort((left, right) => left.snapshot_order - right.snapshot_order)
    .map((prompt, index) => ({
      id: -(index + 1),
      run_id: run.id,
      prompt_snapshot_id: prompt.id,
      judge_model_snapshot_id:
        run.model_snapshots.find((item) => item.role === "judge")?.id ?? 0,
      batch_type: "absolute",
      batch_index: 1,
      randomized_candidate_ids_jsonb: "[]",
      request_payload_jsonb: null,
      raw_response_text: null,
      raw_response_jsonb: null,
      status: "pending",
      started_at: null,
      completed_at: null,
      error_message: null,
      evaluation: null,
    }));

  return {
    run_id: run.id,
    run_status: "judging",
    total_batches: items.length,
    completed_batches: 0,
    failed_batches: 0,
    running_batches: 0,
    pending_batches: items.length,
    items,
  };
}

function PromptRankingMatrix({
  judging,
  responses,
  run,
}: {
  judging: RunJudging | undefined;
  responses: CandidateResponse[];
  run: Run;
}) {
  const completedBatches = useMemo(
    () =>
      judging?.items.filter(
        (batch) =>
          batch.batch_type === "absolute" &&
          isJudgeBatchCompleted(batch),
      ) ?? [],
    [judging?.items],
  );

  // Columns = unique (prompt_snapshot_id, judge_model_snapshot_id) pairs in prompt order
  const columns = useMemo(() => {
    return run.prompt_snapshots
      .filter((prompt) => completedBatches.some((b) => b.prompt_snapshot_id === prompt.id))
      .map((prompt) => ({ promptId: prompt.id }));
  }, [completedBatches, run.prompt_snapshots]);

  const candidates = useMemo(
    () => run.model_snapshots.filter((item) => item.role === "candidate"),
    [run.model_snapshots],
  );
  const isCompactMatrix = columns.length >= 10;

  // For each prompt: Map<candidateId, rank>
  // #1 = top-3 absolute scorer with best arena win rate; rest sorted by absolute score
  const promptRankings = useMemo(() => {
    const arenaBatches = judging?.items.filter(
      (b) => b.batch_type === "arena" && b.status === "completed" && b.evaluation,
    ) ?? [];

    return new Map(
      columns.map(({ promptId }) => {
        const promptAbsBatches = completedBatches.filter((b) => b.prompt_snapshot_id === promptId);
        const promptArenaBatches = arenaBatches.filter((b) => b.prompt_snapshot_id === promptId);

        const candidateScores = candidates.map((cand) => {
          const scores = promptAbsBatches.flatMap((b) => {
            const ec = b.evaluation?.candidates.find((c) => {
              const r = responses.find((r) => r.id === c.candidate_response_id);
              return r?.model_snapshot_id === cand.id;
            });
            return ec ? [Number(ec.overall_score) || 0] : [];
          });
          return { id: cand.id, score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0 };
        });

        const sortedByScore = [...candidateScores].sort((a, b) => b.score - a.score);
        const top3Ids = sortedByScore.slice(0, 3).map((x) => x.id);

        const arenaWinnerId = (() => {
          if (promptArenaBatches.length === 0) return top3Ids[0];
          const winRates = top3Ids.map((id) => {
            const appeared = promptArenaBatches.filter((b) =>
              b.evaluation?.candidates.some((c) => {
                const r = responses.find((r) => r.id === c.candidate_response_id);
                return r?.model_snapshot_id === id;
              }),
            );
            const wins = appeared.filter((b) => {
              const ec = b.evaluation?.candidates.find((c) => {
                const r = responses.find((r) => r.id === c.candidate_response_id);
                return r?.model_snapshot_id === id;
              });
              return ec?.ranking_in_batch === 1;
            });
            return { id, winRate: appeared.length > 0 ? wins.length / appeared.length : 0 };
          });
          return winRates.sort((a, b) => b.winRate - a.winRate)[0].id;
        })();

        const rankedIds = [arenaWinnerId, ...sortedByScore.filter((x) => x.id !== arenaWinnerId).map((x) => x.id)];
        const rankMap = new Map<number, number>();
        rankedIds.forEach((id, i) => rankMap.set(id, i + 1));
        return [promptId, rankMap] as const;
      }),
    );
  }, [columns, completedBatches, judging?.items, candidates, responses]);

  if (completedBatches.length === 0 || candidates.length === 0) {
    return (
      <EmptyStatePanel
        title="No scenario ranking yet"
        description="Scenario-by-scenario ranking becomes available after absolute judge jobs complete."
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Scenario Ranking Matrix"
      />
      <div className={cn(
        "overflow-hidden rounded-[1.25rem] border border-border/80 bg-white",
        isCompactMatrix ? "p-2" : "p-3",
      )}>
        <div className="max-w-full overflow-hidden">
          <table className="w-full table-fixed divide-y divide-border/80 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className={cn(
                  "bg-slate-50 px-2 py-2 font-semibold",
                  isCompactMatrix ? "w-[9rem]" : "w-[13rem]",
                )}>
                  Model
                </th>
                {columns.map(({ promptId }, index) => {
                  const prompt = promptById(run.prompt_snapshots, promptId);
                  return (
                    <th key={promptId} className={cn("py-2 font-semibold", isCompactMatrix ? "px-0.5" : "px-1.5")}>
                      <div className="space-y-0.5 text-center">
                        <p className={cn(
                          "truncate font-semibold uppercase text-slate-400",
                          isCompactMatrix ? "text-[9px]" : "text-[10px] tracking-[0.14em]",
                        )}>
                          P{index + 1}
                        </p>
                        <p className={cn("truncate text-slate-700", isCompactMatrix ? "text-[10px]" : "text-[11px]")}>
                          {prompt?.name ?? `Scenario #${promptId}`}
                        </p>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td className={cn(
                    "bg-white px-2 py-1.5 align-middle",
                    isCompactMatrix ? "w-[9rem]" : "w-[13rem]",
                  )}>
                    <div className="space-y-0.5">
                      <p className={cn("truncate font-medium text-slate-950", isCompactMatrix ? "text-[11px]" : "text-xs")}>
                        {candidate.display_name}
                      </p>
                      <p className={cn("truncate text-slate-500", isCompactMatrix ? "text-[9px]" : "text-[10px]")}>
                        {candidate.provider_type} / {candidate.runtime_type}
                      </p>
                    </div>
                  </td>
                  {columns.map(({ promptId }) => {
                    const promptBatches = completedBatches.filter(
                      (b) => b.prompt_snapshot_id === promptId,
                    );
                    // Collect all evaluation entries for this candidate across all judges
                    const evalEntries = promptBatches.flatMap((b) => {
                      const ec = b.evaluation?.candidates.find((c) => {
                        const r = responses.find((r) => r.id === c.candidate_response_id);
                        return r?.model_snapshot_id === candidate.id;
                      });
                      return ec ? [ec] : [];
                    });

                    if (evalEntries.length === 0) {
                      return (
                        <td key={`${candidate.id}-${promptId}`} className={cn("py-2", isCompactMatrix ? "px-0.5" : "px-1.5")}>
                          <div className={cn(
                            "rounded-lg border border-dashed border-border/70 bg-slate-50 text-center text-slate-400",
                            isCompactMatrix ? "px-1 py-1.5 text-[9px]" : "px-2 py-2 text-[10px]",
                          )}>
                            —
                          </div>
                        </td>
                      );
                    }

                    const scores = evalEntries.map((ec) => Number(ec.overall_score) || 0);
                    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                    const rank = promptRankings.get(promptId)?.get(candidate.id) ?? candidates.length;
                    const isFirst = rank === 1;
                    const isSecond = rank === 2;
                    const isThird = rank === 3;
                    const displayScore = Math.round(avgScore);

                    return (
                      <td key={`${candidate.id}-${promptId}`} className={cn("align-middle", isCompactMatrix ? "px-0.5 py-1" : "px-1.5 py-1.5")}>
                        <div
                          className={cn(
                            "flex items-center justify-between rounded-xl border",
                            isCompactMatrix ? "h-[3.25rem] gap-0.5 px-1" : "h-[4.1rem] gap-1 px-2",
                            isFirst
                              ? "border-blue-400 bg-gradient-to-b from-blue-500 to-blue-600 shadow-[0_10px_28px_-8px_rgba(59,130,246,0.65)]"
                              : isSecond
                              ? "border-violet-200 bg-gradient-to-b from-violet-50 to-violet-100/60"
                              : isThird
                              ? "border-teal-200 bg-gradient-to-b from-teal-50/80 to-cyan-50/60"
                              : "border-border/60 bg-slate-50",
                          )}
                        >
                          <span
                            className={cn(
                              "shrink-0 rounded-full font-bold",
                              isCompactMatrix ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[11px]",
                              isFirst
                                ? "bg-blue-400/50 text-white"
                                : isSecond
                                ? "bg-violet-100 text-violet-700"
                                : isThird
                                ? "bg-teal-100 text-teal-700"
                                : "bg-slate-100 text-slate-400",
                            )}
                          >
                            #{rank}
                          </span>
                          <p
                            className={cn(
                              "min-w-0 flex-1 text-right font-bold leading-none tracking-tight",
                              isFirst
                                ? isCompactMatrix ? "text-[1.35rem] text-white" : "text-[1.9rem] text-white"
                                : isSecond
                                ? isCompactMatrix ? "text-[1.25rem] text-violet-900" : "text-[1.65rem] text-violet-900"
                                : isThird
                                ? isCompactMatrix ? "text-[1.25rem] text-teal-800" : "text-[1.65rem] text-teal-800"
                                : isCompactMatrix ? "text-[1.25rem] text-slate-300" : "text-[1.65rem] text-slate-300",
                            )}
                          >
                            {formatScore(String(displayScore))}
                          </p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CostRecapPanel({ run, judging, responses }: { run: Run; judging: RunJudging | undefined; responses: CandidateResponse[] }) {
  const candidateModels = run.model_snapshots.filter((m) => m.role === "candidate");
  const judgeModels = run.model_snapshots.filter((m) => m.role === "judge");

  const phase1Rows = candidateModels.map((model) => {
    const modelResponses = responses.filter((r) => r.model_snapshot_id === model.id);
    const hasCost = modelResponses.some((r) => r.metric?.estimated_cost != null);
    const total = modelResponses.reduce((acc, r) => acc + (r.metric?.estimated_cost ? Number(r.metric.estimated_cost) : 0), 0);
    return { model, cost: hasCost ? total : null };
  });
  const phase1Total = phase1Rows.reduce((acc, row) => {
    return acc + (row.cost ?? 0);
  }, 0);
  const phase1HasCost = phase1Rows.some((r) => r.cost !== null);

  const phase2Rows = judgeModels.map((model) => {
    const batches = judging?.items.filter((b) => b.judge_model_snapshot_id === model.id) ?? [];
    const total = batches.reduce((acc, b) => acc + (b.estimated_cost ? Number(b.estimated_cost) : 0), 0);
    const hasCost = batches.some((b) => b.estimated_cost !== null);
    return { model, cost: hasCost ? total : null };
  });
  const phase2Total = phase2Rows.reduce((acc, row) => acc + (row.cost ?? 0), 0);
  const phase2HasCost = phase2Rows.some((r) => r.cost !== null);

  const grandTotal = phase1Total + phase2Total;
  const hasAnyCost = phase1HasCost || phase2HasCost;

  if (candidateModels.length === 0 && judgeModels.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-slate-50 p-5 space-y-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cost Recap</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Phase 1 */}
        {candidateModels.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">Phase 1 · Candidate execution</p>
            <div className="space-y-1">
              {phase1Rows.map(({ model, cost }) => (
                <div key={model.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate max-w-[60%]">{model.display_name}</span>
                  <span className="font-mono text-slate-800">{cost !== null ? `$${Number(cost).toFixed(4)}` : "—"}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Phase 1</span>
              <span className="text-base font-bold text-sky-700 font-mono">
                {phase1HasCost ? `$${phase1Total.toFixed(4)}` : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Phase 2 */}
        {judgeModels.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Phase 2 · Judging</p>
            <div className="space-y-1">
              {phase2Rows.map(({ model, cost }) => (
                <div key={model.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate max-w-[60%]">{model.display_name}</span>
                  <span className="font-mono text-slate-800">{cost !== null ? `$${cost.toFixed(4)}` : "—"}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Phase 2</span>
              <span className="text-base font-bold text-violet-700 font-mono">
                {phase2HasCost ? `$${phase2Total.toFixed(4)}` : "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Grand total */}
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3">
        <span className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Total session cost</span>
        <span className="text-2xl font-extrabold text-emerald-700 font-mono">
          {hasAnyCost ? `$${grandTotal.toFixed(4)}` : "—"}
        </span>
      </div>
    </div>
  );
}

function AggregatedSummaryTable({ run }: { run: Run }) {
  if (run.global_summaries.length === 0) {
    return <EmptyStatePanel title="No aggregated summaries yet" description="Aggregation runs after judging completes successfully." />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border/80 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Candidate</th>
              <th className="px-4 py-3 font-semibold">Avg Absolute</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
              <th className="px-4 py-3 font-semibold">Tokens</th>
              <th className="px-4 py-3 font-semibold">Cost</th>
              <th className="px-4 py-3 font-semibold">Global</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {[...run.global_summaries]
              .sort((a, b) => parseFloat(b.final_global_score ?? b.average_overall_score) - parseFloat(a.final_global_score ?? a.average_overall_score))
              .map((summary) => {
              const model = modelById(run.model_snapshots, summary.model_snapshot_id);
              return (
                <tr key={summary.id}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-950">
                        {model?.display_name ?? "Unknown model"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {model
                          ? `${model.provider_type} / ${model.runtime_type}`
                          : "Missing snapshot"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <ScoreBadge value={summary.average_overall_score} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDuration(summary.avg_duration_ms)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {summary.avg_total_tokens ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatCost(summary.total_estimated_cost)}
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge value={summary.final_global_score} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {run.global_summaries.map((summary) => {
          const model = modelById(run.model_snapshots, summary.model_snapshot_id);
          return (
            <div
              key={`detail-${summary.id}`}
              className="overflow-hidden rounded-[1.2rem] border border-border/60 bg-[hsl(var(--surface-overlay))] shadow-[0_18px_42px_-32px_rgba(15,23,42,0.14)]"
            >
              <div className="border-b border-border/40 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.95rem] font-semibold text-foreground">
                      {model?.display_name ?? "Unknown model"}
                    </p>
                    <p className="mt-1 text-[0.76rem] text-muted-foreground">
                      {model
                        ? `${model.provider_type} / ${model.runtime_type}`
                        : "Missing snapshot"}
                    </p>
                  </div>
                  <ScoreBadge value={summary.final_global_score} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="accent" className="whitespace-nowrap text-[0.68rem]">
                    avg {formatScore(summary.average_overall_score)}
                  </Badge>
                  <Badge variant="accent" className="whitespace-nowrap text-[0.68rem]">
                    {formatDuration(summary.avg_duration_ms)}
                  </Badge>
                  <Badge variant="accent" className="whitespace-nowrap text-[0.68rem]">
                    {formatCost(summary.total_estimated_cost)}
                  </Badge>
                </div>
                <p className="mt-3 text-[0.8rem] leading-6 text-muted-foreground">
                  {summary.global_summary_text ?? "No global summary generated."}
                </p>
              </div>

              <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
                <SummaryInsightCard
                  icon={Sparkles}
                  label="Best patterns"
                  tone="good"
                  value={summary.best_patterns_text ?? "No repeated strengths captured."}
                />
                <SummaryInsightCard
                  icon={Clock3}
                  label="Weak patterns"
                  tone="warn"
                  value={summary.weak_patterns_text ?? "No repeated weaknesses captured."}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PassAtKSummaryTable({ run }: { run: Run }) {
  if (run.pass_at_k_summaries.length === 0) {
    return null;
  }

  const sortedSummaries = [...run.pass_at_k_summaries].sort(
    (a, b) => b.pass_5_rate - a.pass_5_rate,
  );

  // Collect all distinct difficulty levels across all models, sorted ascending
  const difficultyLevels = [
    ...new Set(
      sortedSummaries.flatMap((s) => s.difficulty_breakdown.map((d) => d.difficulty)),
    ),
  ].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Code Generation — pass@k
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/80 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">pass@1</th>
                <th className="px-4 py-3 font-semibold">pass@3</th>
                <th className="px-4 py-3 font-semibold">pass@5</th>
                <th className="px-4 py-3 font-semibold">Iteration Potential</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {sortedSummaries.map((summary: PassAtKSummary) => {
                const model = run.model_snapshots.find(
                  (m) => m.id === summary.model_snapshot_id,
                );
                const iterationPotential = summary.pass_5_rate - summary.pass_1_rate;
                return (
                  <tr key={summary.model_snapshot_id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-950">
                        {model?.display_name ?? `Model #${summary.model_snapshot_id}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {summary.code_gen_prompt_count} prompt{summary.code_gen_prompt_count !== 1 ? "s" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {`${(summary.pass_1_rate * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {`${(summary.pass_3_rate * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {`${(summary.pass_5_rate * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {`${(iterationPotential * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {difficultyLevels.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            pass@1 by Difficulty
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/80 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Difficulty</th>
                  {sortedSummaries.map((s) => {
                    const model = run.model_snapshots.find(
                      (m) => m.id === s.model_snapshot_id,
                    );
                    return (
                      <th key={s.model_snapshot_id} className="px-4 py-3 font-semibold">
                        {model?.display_name ?? `Model #${s.model_snapshot_id}`}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {difficultyLevels.map((diff) => (
                  <tr key={diff}>
                    <td className="px-4 py-3 font-medium text-slate-950">{diff}</td>
                    {sortedSummaries.map((s) => {
                      const entry = s.difficulty_breakdown.find(
                        (d) => d.difficulty === diff,
                      );
                      return (
                        <td key={s.model_snapshot_id} className="px-4 py-3 text-slate-700">
                          {entry
                            ? `${(entry.pass_1_rate * 100).toFixed(1)}% (${entry.prompt_count})`
                            : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryInsightCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  tone: "good" | "warn";
  value: string;
}) {
  return (
    <div className="rounded-[1rem] border border-border/50 bg-[hsl(var(--surface))] p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg",
            tone === "good" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-3 text-[0.82rem] leading-6 text-foreground">
        {value}
      </p>
    </div>
  );
}

function parseBatchCandidateIds(batch: JudgeBatch): number[] {
  try {
    const ids = JSON.parse(batch.randomized_candidate_ids_jsonb);
    return Array.isArray(ids) ? ids.map(Number) : [];
  } catch {
    return [];
  }
}

function modelNameForCandidateResponse(
  candidateResponseId: number,
  responses: CandidateResponse[],
  modelSnapshots: RunModelSnapshot[],
): string {
  const response = responses.find((r) => r.id === candidateResponseId);
  if (!response) return `Response #${candidateResponseId}`;
  const model = modelSnapshots.find((m) => m.id === response.model_snapshot_id);
  return model?.display_name ?? `Model #${response.model_snapshot_id}`;
}

function promptAggregateStatus(batches: JudgeBatch[]): string {
  if (batches.length === 0) return "pending";
  if (batches.every(isJudgeBatchCompleted)) return "completed";
  if (batches.some((b) => !isJudgeBatchCompleted(b) && b.status === "failed")) return "failed";
  if (batches.some((b) => !isJudgeBatchCompleted(b) && b.status === "running")) return "running";
  return "pending";
}

function judgeBatchDisplayStatus(batch: JudgeBatch): string {
  return isJudgeBatchCompleted(batch) ? "completed" : batch.status;
}

function isJudgeBatchCompleted(batch: JudgeBatch): boolean {
  return batch.status === "completed" || batch.evaluation !== null;
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
  if (!level) return null;
  return (
    <span
      className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white", DIFFICULTY_COLORS[level])}
      title={`Difficulté : ${DIFFICULTY_LABELS[level] ?? level}`}
    >
      {level}
    </span>
  );
}

function JudgeBatchPanel({
  isClearing,
  isLoading,
  isRestarting,
  isStarting,
  isRetrying,
  onClear,
  onRestart,
  canStart,
  judging,
  onStart,
  onRetry,
  promptSnapshots,
  selectedPromptId,
  onSelectPrompt,
}: {
  isClearing: boolean;
  isLoading: boolean;
  isRestarting: boolean;
  isStarting: boolean;
  isRetrying: boolean;
  onClear: () => void;
  onRestart: () => void;
  canStart: boolean;
  judging: RunJudging | undefined;
  onStart: () => void;
  onRetry: () => void;
  promptSnapshots: RunPromptSnapshot[];
  selectedPromptId: number | null;
  onSelectPrompt: (promptId: number) => void;
}) {
  const isJudgingActive = isStarting || isRetrying || isClearing || isRestarting;

  const promptsWithBatches = promptSnapshots
    .map((prompt) => ({
      prompt,
      batches: judging?.items.filter((b) => b.prompt_snapshot_id === prompt.id) ?? [],
    }))
    .filter((g) => g.batches.length > 0);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading judge jobs...</p>;
  }

  if (!judging || judging.items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Button
          className="h-11 w-full gap-2 text-sm font-semibold"
          disabled={!canStart || isStarting}
          onClick={onStart}
          variant="secondary"
        >
          {isStarting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Judging in progress…
            </>
          ) : (
            <>
              <Gavel className="h-4 w-4" />
              Launch judging
            </>
          )}
        </Button>
        <div className="space-y-3">
          <div className="flex gap-3 rounded-[1rem] border border-sky-200/70 bg-sky-50/40 px-4 py-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-[11px] font-bold">
              1
            </div>
            <div>
              <p className="text-[0.82rem] font-semibold text-slate-900">Absolute review</p>
              <p className="mt-0.5 text-[0.79rem] leading-5 text-slate-500">
                Chaque modèle candidat est évalué indépendamment sur chaque prompt — score absolu de 0 à 100 sur 6 critères.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-[1rem] border border-violet-200/70 bg-violet-50/40 px-4 py-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">
              2
            </div>
            <div>
              <p className="text-[0.82rem] font-semibold text-slate-900">Arena pairwise</p>
              <p className="mt-0.5 text-[0.79rem] leading-5 text-slate-500">
                Les meilleurs modèles s'affrontent 2 par 2 par prompt — jusqu'à 3 matchs si les scores sont serrés (écart ≤ 3 pts).
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isJudgingActive ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-amber-600" />
          <p className="text-sm font-medium text-amber-900">
            {isClearing
              ? "Clearing phase 2…"
              : isRestarting
                ? "Restarting phase 2…"
                : isStarting || isRetrying
                  ? "Running judge jobs…"
                  : "Retrying job…"}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-8 gap-1.5 px-3 text-xs font-semibold" disabled={isJudgingActive} onClick={onRetry} variant="secondary">
          <LoaderCircle className="h-3.5 w-3.5" />
          Retry failed
        </Button>
        <Button className="h-8 gap-1.5 px-3 text-xs font-semibold" disabled={isJudgingActive} onClick={onRestart} variant="secondary">
          Restart
        </Button>
        <Button className="h-8 gap-1.5 px-3 text-xs font-semibold" disabled={isJudgingActive} onClick={onClear} variant="dangerSoft">
          Clear all
        </Button>
      </div>

      <div className="overflow-hidden rounded-[1rem] border border-border/70 bg-white shadow-sm">
        {promptsWithBatches.map(({ prompt, batches }, idx) => {
          const status = promptAggregateStatus(batches);
          const isSelected = selectedPromptId === prompt.id;
          return (
            <button
              key={prompt.id}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150",
                idx > 0 && "border-t border-border/50",
                isSelected
                  ? "bg-sky-50"
                  : "hover:bg-slate-50/80",
              )}
              onClick={() => onSelectPrompt(prompt.id)}
              type="button"
            >
              <DifficultyDot level={prompt.difficulty ?? null} />
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "truncate text-[0.82rem] font-medium",
                  isSelected ? "text-sky-800" : "text-slate-800",
                )}>
                  {prompt.name}
                </p>
              </div>
              <StatusPill status={status} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function avgBatchScore(batches: JudgeBatch[]): number | null {
  const scores = batches
    .flatMap((b) => b.evaluation?.candidates ?? [])
    .map((c) => parseFloat(c.overall_score))
    .filter((s) => Number.isFinite(s));
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function PromptJudgeResultsPanel({
  promptId,
  promptSnapshots,
  judging,
  modelSnapshots,
  responses,
  run,
  retryingBatchIds,
  isJudgingActive,
  onInspectBatch,
  onRetryBatch,
  onSelectResponse,
}: {
  promptId: number | null;
  promptSnapshots: RunPromptSnapshot[];
  judging: RunJudging | undefined;
  modelSnapshots: RunModelSnapshot[];
  responses: CandidateResponse[];
  run: Run;
  retryingBatchIds: number[];
  isJudgingActive: boolean;
  onInspectBatch: (batchId: number) => void;
  onRetryBatch: (batchId: number) => void;
  onSelectResponse: (responseId: number) => void;
}) {
  const [expandedModels, setExpandedModels] = useState<Set<number>>(new Set());
  const [expandedArena, setExpandedArena] = useState<Set<number>>(new Set());

  const toggleModel = (id: number) =>
    setExpandedModels((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleArena = (id: number) =>
    setExpandedArena((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!promptId || !judging) {
    return (
      <div className="rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-4">
        <p className="text-[0.9rem] font-semibold text-slate-950">Select a prompt</p>
        <p className="mt-1 text-[0.82rem] text-slate-500">Click a prompt on the left to see all model results.</p>
      </div>
    );
  }

  const prompt = promptSnapshots.find((p) => p.id === promptId);
  const promptBatches = judging.items.filter((b) => b.prompt_snapshot_id === promptId);
  const absoluteBatches = promptBatches.filter((b) => b.batch_type === "absolute");
  const arenaBatches = promptBatches.filter((b) => b.batch_type === "arena");

  // Group absolute batches by candidate model (dedup multiple judges)
  const modelGroupsMap: Map<number, { modelName: string; batches: JudgeBatch[] }> = new Map();
  for (const batch of absoluteBatches) {
    const [candidateId] = parseBatchCandidateIds(batch);
    if (candidateId === undefined) continue;
    const response = responses.find((r) => r.id === candidateId);
    if (!response) continue;
    const modelSnapshotId = response.model_snapshot_id;
    if (!modelGroupsMap.has(modelSnapshotId)) {
      const model = modelSnapshots.find((m) => m.id === modelSnapshotId);
      modelGroupsMap.set(modelSnapshotId, {
        modelName: model?.display_name ?? `Model #${modelSnapshotId}`,
        batches: [],
      });
    }
    modelGroupsMap.get(modelSnapshotId)!.batches.push(batch);
  }

  // Sort by avg overall score descending (null scores go last)
  const sortedModelGroups = [...modelGroupsMap.entries()].sort(([, a], [, b]) => {
    const scoreA = avgBatchScore(a.batches);
    const scoreB = avgBatchScore(b.batches);
    if (scoreA === null && scoreB === null) return 0;
    if (scoreA === null) return 1;
    if (scoreB === null) return -1;
    return scoreB - scoreA;
  });

  const multipleJudges = [...modelGroupsMap.values()].some((g) => g.batches.length > 1);

  return (
    <div className="space-y-4">
      {sortedModelGroups.length > 0 ? (
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Absolute Review
          </p>
          {sortedModelGroups.map(([modelSnapshotId, { modelName, batches }], rank) => {
            const isExpanded = expandedModels.has(modelSnapshotId);
            const avgScore = avgBatchScore(batches);
            const aggregateStatus = promptAggregateStatus(batches);
            return (
              <div
                key={modelSnapshotId}
                className="overflow-hidden rounded-[1rem] border border-sky-200/70 bg-white shadow-[0_3px_10px_-6px_rgba(14,165,233,0.08)]"
              >
                {/* Compact header row — always visible */}
                <button
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-sky-50/60"
                  onClick={() => toggleModel(modelSnapshotId)}
                  type="button"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                    {rank + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-400 shrink-0">Candidate</span>
                    <p className="min-w-0 truncate text-[0.82rem] font-semibold text-slate-800">
                      {modelName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {avgScore !== null ? (
                      <span className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold",
                        scoreToneClasses(String(avgScore.toFixed(0)), "badge"),
                      )}>
                        {avgScore.toFixed(0)}
                      </span>
                    ) : null}
                    <StatusPill status={aggregateStatus} />
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )} />
                  </div>
                </button>

                {/* Expanded judge details */}
                {isExpanded ? (
                  <div className="border-t border-sky-100/80">
                    {batches.map((batch, bIdx) => {
                      const judgeModel = modelSnapshots.find((m) => m.id === batch.judge_model_snapshot_id);
                      const isBatchRetrying = retryingBatchIds.includes(batch.id);
                      return (
                        <div key={batch.id} className={cn("px-3 py-2", bIdx > 0 && "border-t border-sky-100/60")}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <Gavel className="h-3 w-3 shrink-0 text-violet-400" />
                              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-400">
                                Judge
                              </span>
                              {judgeModel ? (
                                <span className="min-w-0 truncate text-[0.74rem] font-medium text-slate-600">
                                  {judgeModel.display_name}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <StatusPill status={isBatchRetrying ? "running" : judgeBatchDisplayStatus(batch)} />
                              {batch.status === "failed" && !batch.evaluation && !isBatchRetrying ? (
                                <Button disabled={isJudgingActive} onClick={() => onRetryBatch(batch.id)} size="sm" variant="secondary">
                                  Retry
                                </Button>
                              ) : null}
                              {batch.evaluation ? (
                                <button
                                  className="rounded p-0.5 text-violet-400 transition-colors hover:text-violet-700"
                                  onClick={(e) => { e.stopPropagation(); onInspectBatch(batch.id); }}
                                  title="View full judge response"
                                  type="button"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {batch.evaluation ? (
                            <JudgeFeedbackPanel
                              batch={batch}
                              responses={responses}
                              run={run}
                              onSelectResponse={onSelectResponse}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {arenaBatches.length > 0 ? (
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Arena Pairwise
          </p>
          {arenaBatches.map((batch) => {
            const candidateIds = parseBatchCandidateIds(batch);
            const nameA = candidateIds[0] !== undefined ? modelNameForCandidateResponse(candidateIds[0], responses, modelSnapshots) : "?";
            const nameB = candidateIds[1] !== undefined ? modelNameForCandidateResponse(candidateIds[1], responses, modelSnapshots) : "?";
            const isBatchRetrying = retryingBatchIds.includes(batch.id);
            const winner = batch.evaluation?.candidates.find((c) => c.ranking_in_batch === 1);
            const winnerName = winner
              ? modelNameForCandidateResponse(winner.candidate_response_id, responses, modelSnapshots)
              : null;
            const isExpanded = expandedArena.has(batch.id);
            return (
              <div
                key={batch.id}
                className="overflow-hidden rounded-[1rem] border border-violet-200/70 bg-white shadow-[0_3px_10px_-6px_rgba(139,92,246,0.08)]"
              >
                <button
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-violet-50/50"
                  onClick={() => toggleArena(batch.id)}
                  type="button"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.82rem] font-semibold text-slate-800">
                      {nameA} <span className="font-normal text-slate-400">vs</span> {nameB}
                    </p>
                    {winnerName ? (
                      <p className="mt-0.5 text-[0.74rem] font-medium text-emerald-600">
                        ↑ {winnerName}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusPill
                      status={isBatchRetrying ? "running" : batch.status}
                      title={batch.status === "failed" && !batch.evaluation && batch.error_message ? batch.error_message : undefined}
                    />
                    {batch.status === "failed" && !batch.evaluation && !isBatchRetrying ? (
                      <Button disabled={isJudgingActive} onClick={(e) => { e.stopPropagation(); onRetryBatch(batch.id); }} size="sm" variant="secondary">
                        Retry
                      </Button>
                    ) : null}
                    {batch.evaluation ? (
                      <button
                        className="rounded p-0.5 text-violet-400 transition-colors hover:text-violet-700"
                        onClick={(e) => { e.stopPropagation(); onInspectBatch(batch.id); }}
                        title="View match details"
                        type="button"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )} />
                  </div>
                </button>
                {isExpanded && (batch.evaluation || batch.error_message) ? (
                  <div className="border-t border-violet-100/80 px-3 py-2 space-y-2">
                    {batch.error_message ? (
                      <CodeBlock content={batch.error_message} tone="rose" />
                    ) : null}
                    {batch.evaluation ? (
                      <JudgeFeedbackPanel
                        batch={batch}
                        responses={responses}
                        run={run}
                        onSelectResponse={onSelectResponse}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function JudgeFeedbackPanel({
  batch,
  onSelectResponse,
  responses,
  run,
}: {
  batch: JudgeBatch | null;
  onSelectResponse: (responseId: number) => void;
  responses: CandidateResponse[];
  run: Run;
}) {
  if (!batch) {
    return (
      <div className="min-h-[7rem] rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-4 shadow-[0_8px_18px_-26px_rgba(15,23,42,0.18)]">
        <p className="text-[0.9rem] font-semibold tracking-tight text-slate-950">
          Select a judge job
        </p>
        <p className="mt-2 max-w-[29rem] text-[0.92rem] leading-6 text-slate-600">
          Choose one job to inspect rankings, criterion scores, and written feedback.
        </p>
      </div>
    );
  }

  if (!batch.evaluation) {
    return (
      <EmptyStatePanel
        title={
          batch.status === "running"
            ? "Judge is evaluating this scenario"
            : batch.status === "pending"
              ? "Judge job is queued"
              : "No parsed judge evaluation yet"
        }
        description={
          batch.error_message ??
          (batch.status === "running"
            ? "Results will appear here as soon as this scenario is completed."
            : batch.status === "pending"
              ? "This job is waiting for its turn. Completed jobs can already be inspected while this one is queued."
              : "The selected job has not completed.")
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {batch.evaluation.candidates.map((candidate) => (
        <JudgeCandidateCard
          key={candidate.id}
          candidate={candidate}
          onSelectResponse={onSelectResponse}
          response={responses.find((item) => item.id === candidate.candidate_response_id)}
          run={run}
        />
      ))}
    </div>
  );
}


function JudgeCandidateCard({
  candidate,
  onSelectResponse,
  response,
  run,
}: {
  candidate: JudgeEvaluationCandidate;
  onSelectResponse: (responseId: number) => void;
  response: CandidateResponse | undefined;
  run: Run;
}) {
  const model = response ? modelById(run.model_snapshots, response.model_snapshot_id) : undefined;

  return (
    <CandidateFeedbackAccordion
      candidate={candidate}
      model={model}
      onOpenResponse={response ? () => onSelectResponse(response.id) : undefined}
      executionTier={response?.execution_tier ?? null}
    />
  );
}

function ScoreStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-lg border px-1.5 py-1.5 text-center transition-all duration-200",
        scoreToneClasses(value, "soft"),
        highlight && "ring-1 ring-inset ring-slate-300",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 truncate leading-tight">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-none">{formatScore(value)}</p>
    </div>
  );
}

function ScoreBadge({ value }: { value: string | null | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        scoreToneClasses(value, "badge"),
      )}
    >
      {formatScore(value)}
    </span>
  );
}

function FeedbackBlock({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-slate-50 p-2.5 transition-colors duration-200 hover:bg-white">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className="h-3 w-3 text-slate-400" /> : null}
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-700">{value}</p>
    </div>
  );
}

function ExecutionTierBadge({ tier }: { tier: number | null }) {
  if (tier === 2) {
    return (
      <Badge className="whitespace-nowrap bg-emerald-100 text-emerald-800 text-[0.7rem]">
        Execution: Pass
      </Badge>
    );
  }
  if (tier === 1) {
    return (
      <Badge className="whitespace-nowrap bg-amber-100 text-amber-800 text-[0.7rem]">
        Execution: Partial
      </Badge>
    );
  }
  if (tier === 0) {
    return (
      <Badge className="whitespace-nowrap bg-rose-100 text-rose-800 text-[0.7rem]">
        Execution: Fail
      </Badge>
    );
  }
  return null;
}

function CandidateFeedbackAccordion({
  candidate,
  executionTier = null,
  model,
  onOpenResponse,
}: {
  candidate: JudgeEvaluationCandidate;
  executionTier?: number | null;
  model: RunModelSnapshot | undefined;
  onOpenResponse?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        "group rounded-xl border border-border/80 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-[0_20px_40px_-32px_rgba(15,23,42,0.22)]",
        isExpanded && "shadow-[0_20px_44px_-34px_rgba(15,23,42,0.26)]",
      )}
    >
      <div
        className={cn(
          "p-3 outline-none transition-colors duration-200",
          onOpenResponse &&
            "cursor-pointer active:scale-[0.997]",
        )}
        onClick={() => onOpenResponse?.()}
        onKeyDown={(event) => {
          if (!onOpenResponse) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenResponse();
          }
        }}
        role={onOpenResponse ? "button" : undefined}
        tabIndex={onOpenResponse ? 0 : undefined}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Candidate
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              {candidate.anonymized_candidate_label}
            </span>
          </div>
          <p className="min-w-0 truncate text-sm font-semibold text-slate-950 transition-colors duration-150 group-hover:text-slate-700">
            {model?.display_name ?? "Candidate model"}
          </p>
          <span className="truncate text-xs text-slate-400">
            {model ? `${model.provider_type} / ${model.runtime_type}` : ""}
          </span>
          <ExecutionTierBadge tier={executionTier} />
        </div>
        <div className="mt-2 grid grid-cols-[2rem_repeat(6,minmax(0,1fr))_4px_minmax(0,1fr)] items-stretch gap-1.5">
          <button
            className={cn(
              "flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-all duration-200 hover:border-slate-300 hover:bg-white active:scale-[0.97]",
              isExpanded && "bg-slate-100",
            )}
            onClick={(event) => {
              event.stopPropagation();
              setIsExpanded((current) => !current);
            }}
            type="button"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-all duration-200 group-hover:text-slate-500",
                isExpanded && "rotate-180 text-slate-600",
              )}
            />
          </button>
          <ScoreStat label="Relev." value={candidate.relevance_score} />
          <ScoreStat label="Accur." value={candidate.accuracy_score} />
          <ScoreStat label="Compl." value={candidate.completeness_score} />
          <ScoreStat label="Clarity" value={candidate.clarity_score} />
          <ScoreStat label="Instr." value={candidate.instruction_following_score} />
          <ScoreStat label="Confid." value={candidate.judge_confidence_score ?? "—"} />
          <div className="self-stretch rounded-full bg-border/70" />
          <ScoreStat label="Overall" value={candidate.overall_score} highlight />
        </div>
      </div>
      {isExpanded ? (
        <div className="border-t border-border/70 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <FeedbackBlock
              icon={Sparkles}
              label="Strengths"
              value={candidate.strengths_text ?? "No strengths summary provided."}
            />
            <FeedbackBlock
              icon={Clock3}
              label="Weaknesses"
              value={candidate.weaknesses_text ?? "No weaknesses summary provided."}
            />
          </div>
          <div className="mt-2 space-y-2">
            <FeedbackBlock
              label="Short feedback"
              value={candidate.short_feedback ?? "No short feedback provided."}
            />
            <FeedbackBlock
              label="Detailed feedback"
              value={candidate.detailed_feedback ?? "No detailed feedback provided."}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyStatePanel({
  description,
  title,
  tone = "default",
}: {
  description: string;
  title: string;
  tone?: "default" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.4rem] border p-4",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-border/80 bg-slate-50",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          tone === "success" ? "text-emerald-950" : "text-slate-950",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mt-2 text-sm",
          tone === "success" ? "text-emerald-900" : "text-slate-600",
        )}
      >
        {description}
      </p>
    </div>
  );
}

function promptById(items: RunPromptSnapshot[], id: number) {
  return items.find((item) => item.id === id);
}

function modelById(items: RunModelSnapshot[], id: number) {
  return items.find((item) => item.id === id);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function consolidateCandidateResponses(responses: CandidateResponse[]): CandidateResponse[] {
  const byPair = new Map<string, CandidateResponse>();

  for (const response of responses) {
    const key = `${response.prompt_snapshot_id}:${response.model_snapshot_id}`;
    const current = byPair.get(key);

    if (!current || isMoreRecentCandidateResponse(response, current)) {
      byPair.set(key, response);
    }
  }

  return Array.from(byPair.values()).sort((left, right) => {
    if (left.prompt_snapshot_id !== right.prompt_snapshot_id) {
      return left.prompt_snapshot_id - right.prompt_snapshot_id;
    }
    return left.model_snapshot_id - right.model_snapshot_id;
  });
}

function isMoreRecentCandidateResponse(
  next: CandidateResponse,
  current: CandidateResponse,
): boolean {
  if (next.retry_count !== current.retry_count) {
    return next.retry_count > current.retry_count;
  }

  const nextTimestamp = candidateResponseTimestamp(next);
  const currentTimestamp = candidateResponseTimestamp(current);
  if (nextTimestamp !== currentTimestamp) {
    return nextTimestamp > currentTimestamp;
  }

  return next.id > current.id;
}

function candidateResponseTimestamp(response: CandidateResponse): number {
  const value = response.completed_at ?? response.started_at;
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDuration(value: number | null | undefined): string {
  if (!value) {
    return "—";
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(2)} s`;
}

function formatCost(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return `$${Number(value).toFixed(4)}`;
}

function formatScore(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(0) : value;
}

function summarizeShortFeedback(candidate: JudgeEvaluationCandidate): string {
  const text = candidate.short_feedback?.replace(/\s+/g, " ").trim();

  if (!text) {
    return "No summary";
  }

  if (text.length <= 44) {
    return text;
  }

  return `${text.slice(0, 41).trimEnd()}…`;
}


function scoreToneClasses(
  value: string | null | undefined,
  variant: "badge" | "soft",
): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return variant === "badge"
      ? "bg-slate-100 text-slate-700"
      : "border-border/80 bg-slate-50 text-slate-950";
  }

  if (parsed >= 85) {
    return variant === "badge"
      ? "bg-emerald-100 text-emerald-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-950";
  }
  if (parsed >= 70) {
    return variant === "badge"
      ? "bg-sky-100 text-sky-900"
      : "border-sky-200 bg-sky-50 text-sky-950";
  }
  if (parsed >= 55) {
    return variant === "badge"
      ? "bg-amber-100 text-amber-900"
      : "border-amber-200 bg-amber-50 text-amber-950";
  }
  return variant === "badge"
    ? "bg-rose-100 text-rose-900"
    : "border-rose-200 bg-rose-50 text-rose-950";
}
