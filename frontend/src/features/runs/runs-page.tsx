import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
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
  SquareTerminal,
  Trash2,
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
  Run,
  RunDetailPageProps,
  RunPhaseKey,
  RunsPageProps,
} from "./types";
import { terminalStatuses } from "./constants";
import {
  buildOptimisticJudging,
  consolidateCandidateResponses,
  formatCost,
  formatDate,
  formatDuration,
  formatRunListDateTimeShort,
  formatRunListElapsed,
  getTopRunListSummaries,
  isJudgeBatchCompleted,
  isServiceAvailabilityError,
  modelById,
  promptById,
} from "./utils";
import { API_URL, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { AggregatedSummaryTable } from "./components/aggregated-summary-table";
import { CostRecapPanel } from "./components/cost-recap-panel";
import { EmptyStatePanel } from "./components/empty-state-panel";
import { JudgeBatchPanel } from "./components/judge-batch-panel";
import { JudgeInspector } from "./components/judge-inspector";
import { LockedPhasePanel } from "./components/locked-phase-panel";
import { PassAtKSummaryTable } from "./components/pass-at-k-summary-table";
import { PromptJudgeResultsPanel } from "./components/prompt-judge-results-panel";
import { PromptRankingMatrix } from "./components/prompt-ranking-matrix";
import { ResponseInspector } from "./components/response-inspector";
import { RunPhaseSwitcher } from "./components/run-phase-switcher";
import { RunsTableEmptyRow } from "./components/runs-table-empty-row";
import { RunTopThreeSummary } from "./components/run-top-three-summary";
import { SectionHeading } from "./components/section-heading";
import { StatusPill } from "./components/status-pill";
import { SummaryStat } from "./components/summary-stat";

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
                  <PassAtKSummaryTable run={selectedRun} responses={rawResponses} />
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
