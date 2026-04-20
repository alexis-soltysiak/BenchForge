import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  Gavel,
  LoaderCircle,
  Play,
  Search,
  Sparkles,
  SquareTerminal,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Modal } from "@/components/ui/modal";
import {
  confirmLocalReady,
  downloadRunReportPdf,
  fetchLocalNext,
  fetchRun,
  fetchRunJudging,
  fetchRunResponses,
  fetchRuns,
  generateRunReport,
  resumeRun,
  retryCandidateResponse,
  retryJudgeBatch,
  retryRunJudging,
  startLocalCurrent,
  startRemoteCandidate,
  startRunJudging,
} from "@/features/runs/api";
import type {
  CandidateResponse,
  JudgeBatch,
  JudgeEvaluationCandidate,
  LocalExecutionNextResponse,
  Run,
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
  const [previewRun, setPreviewRun] = useState<{ id: number; name: string } | null>(null);

  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: fetchRuns,
    refetchInterval: 5000,
  });

  const visibleRuns = useMemo(() => {
    const items = runsQuery.data?.items ?? [];
    if (!search) {
      return items;
    }

    const needle = search.toLowerCase();
    return items.filter((item) =>
      [item.name, item.status, item.report_status, item.rubric_version]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [runsQuery.data?.items, search]);

  const completedRuns = visibleRuns.filter((item) => item.status === "completed").length;
  const activeRuns = visibleRuns.filter((item) =>
    ["running", "running_candidates", "waiting_local", "ready_for_judging", "judging", "aggregating", "reporting"].includes(
      item.status,
    ),
  ).length;
  const readyReports = visibleRuns.filter((item) => item.report_status === "completed").length;
  const loadError =
    (runsQuery.error instanceof ApiError && runsQuery.error.message) || null;
  const retryLoad = () => {
    void runsQuery.refetch();
  };

  return (
    <div className="px-3 py-5 lg:px-6 lg:py-6 xl:px-7">
      <section className="relative overflow-hidden rounded-[1.65rem] border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3.5 shadow-xl lg:p-4">
        <div className="absolute left-0 top-0 h-full w-[58%] bg-[var(--hero-bg)]" />
        <div className="absolute inset-0 bg-[linear-gradient(var(--hero-grid)_1px,transparent_1px),linear-gradient(90deg,var(--hero-grid)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
        <div className="relative flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_31rem] xl:items-center xl:gap-4">
          <div className="relative max-w-[30rem] space-y-2">
            <span className="inline-flex rounded-full border border-rose-200 bg-[hsl(var(--surface)/0.85)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--foreground-soft))]">
              {t("runs.executionMonitor")}
            </span>
            <h1 className="font-display text-[1.8rem] font-semibold tracking-tight text-foreground lg:text-[2.2rem]">
              {t("runs.pageTitle")}
            </h1>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={Activity}
              label={t("runs.metricVisible")}
              tone="red"
              value={String(visibleRuns.length)}
            />
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={CheckCircle2}
              label={t("runs.metricCompleted")}
              tone="red"
              value={String(completedRuns)}
            />
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={SquareTerminal}
              label={t("runs.metricActive")}
              tone="red"
              value={String(activeRuns)}
            />
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={Gavel}
              label={t("runs.metricReports")}
              tone="red"
              value={String(readyReports)}
            />
          </div>
        </div>
      </section>

      <section className="mt-5">
        <Card className="overflow-hidden border-border/70 bg-[hsl(var(--surface-overlay))] shadow-sm">
          <div className="border-b border-border/80 px-3 py-2.5 lg:px-3.5">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("runs.listTitle")}</h2>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="h-10 rounded-[1rem] pl-9 text-[0.95rem]"
                  placeholder={t("runs.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
          </div>

          {loadError ? (
            <LoadErrorState
              message={loadError}
              onRetry={retryLoad}
              resourceLabel={t("runs.pageTitle")}
            />
          ) : null}

          <div className="divide-y divide-border/70">
            {runsQuery.isLoading ? (
              <div className="px-4 py-10 text-[0.92rem] text-[hsl(var(--foreground-soft))]">{t("runs.loading")}</div>
            ) : visibleRuns.length === 0 ? (
              <div className="px-4 py-7">
                <EmptyStatePanel
                  title={t("runs.noRuns")}
                  description=""
                />
              </div>
            ) : (
              visibleRuns.map((item) => (
                <button
                  key={item.id}
                  className="block w-full px-3.5 py-3 text-left transition hover:bg-[hsl(var(--surface-muted))]"
                  onClick={() => {
                    onOpenRun(item.id);
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.95rem] font-semibold text-foreground">{item.name}</p>
                      <p className="mt-1 text-[0.92rem] text-[hsl(var(--foreground-soft))]">
                        Session #{item.session_id} · {item.prompt_count} prompts ·{" "}
                        {item.model_count} models
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "completed" ? (
                        <Button
                          aria-label={`Preview report for ${item.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPreviewRun({ id: item.id, name: item.name });
                          }}
                          size="iconSm"
                          title={`Preview report for ${item.name}`}
                          type="button"
                          variant="soft"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <StatusPill status={item.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[hsl(var(--foreground-soft))]">
                    <span>Report {item.report_status}</span>
                    <span>Rubric {item.rubric_version}</span>
                    <span>Launched {formatDate(item.launched_at)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </section>

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
    </div>
  );
}

export function RunDetailPage({ onBack, runId }: RunDetailPageProps) {
  const [activePhase, setActivePhase] = useState<RunPhaseKey>("phase1");
  const [selectedResponseId, setSelectedResponseId] = useState<number | null>(null);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [selectedJudgeBatchId, setSelectedJudgeBatchId] = useState<number | null>(null);
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
      return;
    }

    if (selectedJudgeBatchId && items.some((item) => item.id === selectedJudgeBatchId)) {
      return;
    }

    setSelectedJudgeBatchId(items[0].id);
  }, [judgingQuery.data?.items, selectedJudgeBatchId]);

  const refreshRunData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["runs"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", runId] }),
      queryClient.invalidateQueries({ queryKey: ["runs", runId, "responses"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", runId, "local-next"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", runId, "judging"] }),
    ]);
  };

  const resumeMutation = useMutation({
    mutationFn: () => resumeRun(runId),
    onSuccess: async () => {
      setFeedback("Remote candidates resumed.");
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to resume run.");
    },
  });

  const confirmLocalMutation = useMutation({
    mutationFn: () => confirmLocalReady(runId),
    onSuccess: async (payload) => {
      setFeedback(`Local model "${payload.display_name}" marked ready.`);
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
      setFeedback("Current local model started.");
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
      setFeedback("Endpoint candidate started.");
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
      setFeedback("Prompt response retried.");
      await refreshRunData();
    } catch (error) {
      setFeedback(
        error instanceof ApiError ? error.message : "Unable to retry prompt response.",
      );
    } finally {
      setRetryingResponseIds((current) => current.filter((item) => item !== responseId));
    }
  };

  const retryJudgingMutation = useMutation({
    mutationFn: () => retryRunJudging(runId),
    onSuccess: async () => {
      setFeedback("Judging retried.");
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to retry judging.");
    },
  });

  const handleRetryBatch = async (batchId: number) => {
    setRetryingBatchIds((current) => [...current, batchId]);
    try {
      await retryJudgeBatch(runId, batchId);
      setFeedback("Batch retried.");
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

  const generateReportMutation = useMutation({
    mutationFn: () => generateRunReport(runId),
    onSuccess: async () => {
      setFeedback(null);
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to generate report.");
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: () => downloadRunReportPdf(runId),
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to download PDF report.");
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
  const judgingReady =
    allCandidatesReady &&
    !!judging &&
    judging.total_batches > 0 &&
    judging.completed_batches === judging.total_batches &&
    judging.failed_batches === 0;
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
      <div className="mb-1">
        <Button className="h-8 px-2" onClick={onBack} variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to runs
        </Button>
      </div>

      {selectedRun ? (
        <div className="space-y-3">
          <Card className="border-border/70 bg-[hsl(var(--surface-overlay))] p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))]">
                  Run #{selectedRun.id}
                </p>
                <h2 className="mt-2 truncate whitespace-nowrap text-3xl font-semibold tracking-tight text-foreground">
                  {selectedRun.name}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill status={selectedRun.status} />
                  <InfoTag
                    tone="slate"
                    value={formatDate(selectedRun.launched_at)}
                  />
                  <InfoTag
                    tone="sky"
                    value={selectedRun.rubric_version}
                  />
                  <InfoTag
                    tone="rose"
                    value={`${
                      selectedRun.prompt_snapshots.length + selectedRun.model_snapshots.length
                    } records`}
                  />
                  <MetaPill label={`${selectedRun.prompt_snapshots.length} prompts`} />
                  <MetaPill
                    label={`${
                      selectedRun.model_snapshots.filter((item) => item.role === "candidate")
                        .length
                    } candidates`}
                  />
                  <MetaPill
                    label={`${
                      selectedRun.model_snapshots.filter((item) => item.role === "judge").length
                    } judge`}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={resumeMutation.isPending}
                  onClick={() => resumeMutation.mutate()}
                  variant="secondary"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {selectedRun.candidate_response_count === 0
                    ? "Start all endpoints"
                    : "Resume all endpoints"}
                </Button>
              </div>
            </div>

            {loadError ? (
              <div className="mt-5">
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
                <div className="mt-5 rounded-2xl border border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-soft))] px-4 py-3 text-sm text-[hsl(var(--theme-accent-soft-foreground))]">
                  {feedback}
                </div>
              )
            ) : null}
          </Card>

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
                    description="Chaque LLM candidat exécute toute la liste de prompts. Les modèles endpoint tournent directement, les modèles locaux passent par un handoff LM Studio."
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

                <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {candidateSnapshots.map((candidate) => (
                    <CandidateExecutionCard
                      key={candidate.id}
                      candidate={candidate}
                      localState={localNextQuery.data}
                      onConfirmReady={() => confirmLocalMutation.mutate()}
                      onStartCurrent={() => startLocalMutation.mutate()}
                      onStartEndpoint={() => handleStartRemoteCandidate(candidate.id)}
                      promptCount={selectedRun.prompt_snapshots.length}
                      responses={effectiveResponses.filter(
                        (item) => item.model_snapshot_id === candidate.id,
                      )}
                      runStatus={selectedRun.status}
                      isConfirming={confirmLocalMutation.isPending}
                      isStartingEndpoint={startingRemoteIds.includes(candidate.id)}
                      isStarting={startLocalMutation.isPending}
                    />
                  ))}
                </div>
              </Card>

              <Card className="border-border/70 bg-[hsl(var(--surface-overlay))] p-5 shadow-sm">
                <SectionHeading
                  title="Phase 1 · Responses By Prompt"
                  description="Une ligne = un prompt exécuté par un candidat. Clique une réponse pour ouvrir son inspection détaillée dans un grand modal."
                />
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-border/80 text-[0.88rem]">
                    <thead className="bg-[hsl(var(--surface-muted))] text-left text-[hsl(var(--foreground-soft))]">
                      <tr>
                        <th className="px-4 py-2 text-[0.82rem] font-semibold">Prompt</th>
                        <th className="px-4 py-2 text-[0.82rem] font-semibold">Candidate</th>
                        <th className="px-4 py-2 text-[0.82rem] font-semibold">Status</th>
                        <th className="px-4 py-2 text-[0.82rem] font-semibold">Duration</th>
                        <th className="px-4 py-2 text-[0.82rem] font-semibold">Tokens</th>
                        <th className="px-4 py-2 text-[0.82rem] font-semibold">Cost</th>
                        <th className="px-4 py-2 text-[0.82rem] font-semibold">Retries</th>
                        <th className="px-4 py-2 text-[0.82rem] font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {responsesQuery.isLoading ? (
                        <tr>
                          <td className="px-4 py-6 text-[hsl(var(--foreground-soft))]" colSpan={8}>
                            Loading candidate responses...
                          </td>
                        </tr>
                      ) : effectiveResponses.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-[hsl(var(--foreground-soft))]" colSpan={8}>
                            No responses recorded yet. Candidate execution has not produced persisted outputs yet.
                          </td>
                        </tr>
                      ) : (
                        effectiveResponses.map((response) => {
                          const prompt = promptById(
                            selectedRun.prompt_snapshots,
                            response.prompt_snapshot_id,
                          );
                          const model = modelById(
                            selectedRun.model_snapshots,
                            response.model_snapshot_id,
                          );
                          const isRowLoading =
                            retryingResponseIds.includes(response.id) ||
                            response.status === "pending" ||
                            response.status === "running";

                          return (
                              <tr
                                key={response.id}
                                className={cn(
                                  "cursor-pointer transition hover:bg-[hsl(var(--surface-muted))]",
                                  selectedResponseId === response.id &&
                                    "bg-[hsl(var(--surface-muted))]",
                                )}
                                onClick={() => {
                                  openResponseInspector(response.id);
                                }}
                              >
                              <td className="px-4 py-2 align-middle">
                                <div>
                                  <p className="text-[0.88rem] font-medium leading-tight text-foreground">{prompt?.name ?? "Unknown prompt"}</p>
                                  <p className="mt-0.5 text-[0.76rem] leading-tight text-[hsl(var(--foreground-soft))]">{prompt?.category_name ?? "Unknown category"}</p>
                                </div>
                              </td>
                              <td className="px-4 py-2 align-middle">
                                <div>
                                  <p className="text-[0.88rem] font-medium leading-tight text-foreground">{model?.display_name ?? "Unknown model"}</p>
                                  <p className="mt-0.5 text-[0.76rem] leading-tight text-[hsl(var(--foreground-soft))]">
                                    {model ? `${model.provider_type} / ${model.runtime_type}` : "Missing snapshot"}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-2 align-middle">
                                <div className="flex items-center gap-2">
                                  {isRowLoading ? (
                                    <LoaderCircle className="h-2.5 w-2.5 shrink-0 animate-spin text-amber-500" />
                                  ) : response.status === "completed" ? (
                                    <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                                  ) : response.status === "failed" ? (
                                    <XCircle className="h-2.5 w-2.5 shrink-0 text-rose-500" />
                                  ) : (
                                    <Clock3 className="h-2.5 w-2.5 shrink-0 text-[hsl(var(--foreground-soft))]" />
                                  )}
                                  <div className="group/failed relative">
                                    <span
                                      className={cn(
                                        "inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-[0.2rem] text-[0.64rem] font-semibold capitalize",
                                        response.status === "completed" && "bg-emerald-100 text-emerald-900",
                                        ["running", "running_candidates", "waiting_local", "ready_for_judging", "judging", "aggregating", "reporting"].includes(response.status) &&
                                          "bg-amber-100 text-amber-900",
                                        ["failed", "cancelled"].includes(response.status) && "bg-rose-100 text-rose-900",
                                        ["pending", "pending_local"].includes(response.status) && "bg-slate-100 text-slate-700",
                                      )}
                                    >
                                      {response.status.replaceAll("_", " ")}
                                    </span>
                                    {response.status === "failed" && response.error_message ? (
                                      <div className="pointer-events-none absolute left-0 top-full z-30 hidden w-[22rem] pt-2 group-hover/failed:block">
                                        <div className="overflow-hidden rounded-2xl border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.96))] shadow-[0_24px_60px_-28px_rgba(225,29,72,0.45)] backdrop-blur-sm">
                                          <div className="border-b border-rose-200/70 px-3 py-2">
                                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-rose-700">
                                              Execution Error
                                            </p>
                                          </div>
                                          <div className="px-3 py-2.5">
                                            <p className="text-[0.75rem] leading-5 text-slate-700">
                                              {response.error_message}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2 align-middle text-[0.84rem] text-[hsl(var(--foreground-soft))]">
                                {formatDuration(response.metric?.duration_ms)}
                              </td>
                              <td className="px-4 py-2 align-middle text-[0.84rem] text-[hsl(var(--foreground-soft))]">
                                {response.metric?.total_tokens ?? "—"}
                              </td>
                              <td className="px-4 py-2 align-middle text-[0.84rem] text-[hsl(var(--foreground-soft))]">
                                {formatCost(response.metric?.estimated_cost)}
                              </td>
                              <td className="px-4 py-2 align-middle text-[0.84rem] text-[hsl(var(--foreground-soft))]">{response.retry_count}</td>
                              <td className="px-4 py-2 align-middle text-right">
                                {["failed", "cancelled"].includes(response.status) ? (
                                  <Button
                                    className="h-8 px-3 text-[0.82rem]"
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
                                ) : (
                                  <span className="text-[0.78rem] text-[hsl(var(--foreground-soft))]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}

          {activePhase === "phase2" ? (
            <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
              <SectionHeading
                title="Phase 2 · Judging"
                description="Cette phase se déverrouille uniquement quand tous les candidats ont fini tous les prompts."
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
                      isLoading={judgingQuery.isLoading}
                      isStarting={startJudgingMutation.isPending}
                      isRetrying={retryJudgingMutation.isPending}
                      onInspectBatch={() => selectedJudgeBatch && openJudgeInspector(selectedJudgeBatch.id)}
                      retryingBatchIds={retryingBatchIds}
                      canStart={allCandidatesReady && (!judging || judging.items.length === 0)}
                      judging={judging}
                      onStart={() => startJudgingMutation.mutate()}
                      onRetry={() => retryJudgingMutation.mutate()}
                      onRetryBatch={handleRetryBatch}
                      promptSnapshots={selectedRun.prompt_snapshots}
                      onSelectBatch={setSelectedJudgeBatchId}
                      selectedBatchId={selectedJudgeBatchId}
                    />
                  </div>
                  <div>
                    <JudgeFeedbackPanel
                      batch={selectedJudgeBatch}
                      responses={rawResponses}
                      run={selectedRun}
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
                description="Après les jugements, tu peux agréger les scores finaux puis générer les artefacts HTML et PDF."
              />
              {!judgingReady && selectedRun.report_status !== "completed" ? (
                <div className="mt-5">
                  <LockedPhasePanel
                    title="Phase 3 locked"
                    description="Judging must complete successfully for every batch before report generation is available."
                  />
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={generateReportMutation.isPending}
                      onClick={() => generateReportMutation.mutate()}
                      variant="secondary"
                    >
                      Generate report artifacts
                    </Button>
                    <Button
                      disabled={downloadPdfMutation.isPending}
                      onClick={() => downloadPdfMutation.mutate()}
                      variant="secondary"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                    <ReportRow label="Report status" value={selectedRun.report_status} />
                    <ReportRow label="HTML path" value={selectedRun.html_report_path ?? "Pending"} />
                    <ReportRow label="PDF path" value={selectedRun.pdf_report_path ?? "Pending"} />
                  </div>
                  <PromptRankingMatrix
                    judging={judging}
                    responses={rawResponses}
                    run={selectedRun}
                  />
                  <AggregatedSummaryTable run={selectedRun} />
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
                "Unknown prompt"
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
        description="Inspection détaillée du job de jugement sélectionné, avec le prompt, le payload, la réponse brute et le JSON parsé."
        onClose={() => setIsJudgeModalOpen(false)}
        open={isJudgeModalOpen && selectedJudgeBatch !== null && selectedRun !== undefined}
        size="xxl"
        tone="amber"
        title={
          selectedJudgeBatch
            ? `Judge Job · ${
                promptById(selectedRun?.prompt_snapshots ?? [], selectedJudgeBatch.prompt_snapshot_id)
                  ?.name ?? "Unknown prompt"
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
      stageFill: "28%",
      unlocked: true,
      tint: {
        border: "border-orange-200",
        wash: "bg-orange-50/60",
        fill: "",
        icon: "bg-orange-100/80 text-orange-700",
        text: "text-slate-950",
        progress: "bg-orange-400",
      },
    },
    {
      key: "phase2" as const,
      label: "Phase 2",
      subtitle: "Judging",
      icon: Gavel,
      progress: phase2Progress,
      stageFill: "56%",
      unlocked: phase2Unlocked,
      tint: {
        border: "border-amber-200",
        wash: "bg-amber-50/60",
        fill: "",
        icon: "bg-amber-100/80 text-amber-700",
        text: "text-slate-950",
        progress: "bg-amber-500",
      },
    },
    {
      key: "phase3" as const,
      label: "Phase 3",
      subtitle: "Report",
      icon: Sparkles,
      progress: phase3Progress,
      stageFill: "84%",
      unlocked: phase3Unlocked,
      tint: {
        border: "border-teal-200",
        wash: "bg-teal-50/60",
        fill: "",
        icon: "bg-teal-100/80 text-teal-700",
        text: "text-slate-950",
        progress: "bg-teal-500",
      },
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
              "group relative overflow-hidden rounded-[1.45rem] border bg-white text-left transition duration-200",
              isActive
                ? cn(phase.tint.border, "shadow-[0_22px_48px_-28px_rgba(15,23,42,0.28)]")
                : "border-border/80 hover:border-slate-300",
              !phase.unlocked && "opacity-80",
            )}
            disabled={!phase.unlocked}
            onClick={() => onPhaseChange(phase.key)}
            type="button"
          >
            <div className="absolute inset-x-4 bottom-3 h-[4px] overflow-hidden rounded-full bg-slate-200/70">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  phase.tint.progress,
                )}
                style={{ width: progressWidth }}
              />
            </div>

            <div className="relative flex items-start justify-between gap-3 px-4 py-3 pb-7">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
                    phase.tint.icon,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[0.95rem] font-semibold leading-none",
                      isActive ? phase.tint.text : "text-slate-950",
                    )}
                  >
                    {phase.label}
                  </p>
                  <p className="mt-1 text-[0.82rem] leading-none text-slate-500">{phase.subtitle}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold",
                    isActive
                      ? "bg-white/80 text-slate-700"
                      : "bg-slate-100 text-slate-600",
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
        label: isLocal ? "running local prompts" : "running endpoint prompts",
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

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-border/80 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-950">{value}</p>
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

function StatusPill({ label, status }: { label?: string; status: string }) {
  return (
    <span
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
        <SummaryStat label="Prompt" value={prompt?.name ?? "Unknown prompt"} />
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
              eyebrow="Prompt"
              title={prompt?.name ?? "Unknown prompt"}
              subtitle="Le prompt snapshot utilisé pour cette réponse."
            >
              {prompt?.system_prompt_text ? (
                <PromptBlock label="System Prompt" text={prompt.system_prompt_text} />
              ) : null}
              <PromptBlock
                label="User Prompt"
                text={prompt?.user_prompt_text ?? "No prompt text recorded."}
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
        <SummaryStat label="Prompt" value={prompt?.name ?? "Unknown prompt"} />
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
            eyebrow="Prompt"
            title={prompt?.name ?? "Unknown prompt"}
            subtitle="Snapshot évalué par le juge pour ce job."
          >
            {prompt?.system_prompt_text ? (
              <PromptBlock label="System Prompt" text={prompt.system_prompt_text} />
            ) : null}
            <PromptBlock
              label="User Prompt"
              text={prompt?.user_prompt_text ?? "No prompt text recorded."}
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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [matrixScale, setMatrixScale] = useState(1);
  const completedBatches = useMemo(
    () =>
      judging?.items.filter(
        (batch) =>
          batch.batch_type === "absolute" &&
          batch.status === "completed" &&
          batch.evaluation,
      ) ?? [],
    [judging?.items],
  );
  const candidates = useMemo(
    () => run.model_snapshots.filter((item) => item.role === "candidate"),
    [run.model_snapshots],
  );

  useEffect(() => {
    if (completedBatches.length === 0 || candidates.length === 0) {
      return;
    }

    const updateScale = () => {
      const viewport = viewportRef.current;
      const content = contentRef.current;

      if (!viewport || !content) {
        return;
      }

      const availableWidth = viewport.clientWidth;
      const availableHeight = viewport.clientHeight;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;

      if (!availableWidth || !availableHeight || !contentWidth || !contentHeight) {
        setMatrixScale(1);
        return;
      }

      const nextScale = Math.min(
        1,
        availableWidth / contentWidth,
        availableHeight / contentHeight,
      );

      setMatrixScale(nextScale);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    if (viewportRef.current) {
      resizeObserver.observe(viewportRef.current);
    }

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener("resize", updateScale);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [candidates, completedBatches]);

  if (completedBatches.length === 0 || candidates.length === 0) {
    return (
      <EmptyStatePanel
        title="No prompt ranking yet"
        description="Prompt-by-prompt ranking becomes available after absolute judge jobs complete."
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Prompt Ranking Matrix"
        description="Vue compacte ajustée automatiquement pour garder toute la matrice visible à l’écran."
      />
      <div
        ref={viewportRef}
        className="overflow-hidden rounded-[1.25rem] border border-border/80 bg-white p-3"
        style={{ height: "calc(100vh - 19rem)" }}
      >
        <div
          ref={contentRef}
          className="origin-top-left"
          style={{
            transform: `scale(${matrixScale})`,
            width: matrixScale < 1 ? `${100 / matrixScale}%` : "100%",
          }}
        >
          <table className="w-full table-fixed divide-y divide-border/80 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="w-[8.5rem] px-2 py-2 font-semibold">Model</th>
                {completedBatches.map((batch, index) => {
                  const prompt = promptById(run.prompt_snapshots, batch.prompt_snapshot_id);
                  const topScore = Math.max(
                    ...batch.evaluation!.candidates.map((item) => Number(item.overall_score) || 0),
                  );

                  return (
                    <th key={batch.id} className="px-1.5 py-2 font-semibold">
                      <div className="space-y-0.5 text-center">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          P{index + 1}
                        </p>
                        <p className="truncate text-[11px] text-slate-700">
                          {prompt?.name ?? `Prompt #${batch.prompt_snapshot_id}`}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Top {formatScore(String(topScore))}
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
                  <td className="bg-white px-2 py-2 align-top">
                    <div className="space-y-0.5">
                      <p className="truncate text-xs font-medium text-slate-950">
                        {candidate.display_name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {candidate.provider_type} / {candidate.runtime_type}
                      </p>
                    </div>
                  </td>
                  {completedBatches.map((batch) => {
                    const evaluationCandidate = batch.evaluation?.candidates.find((item) => {
                      const response = responses.find(
                        (responseItem) => responseItem.id === item.candidate_response_id,
                      );
                      return response?.model_snapshot_id === candidate.id;
                    });

                    if (!evaluationCandidate) {
                      return (
                        <td key={`${candidate.id}-${batch.id}`} className="px-1.5 py-2">
                          <div className="rounded-lg border border-dashed border-border/70 bg-slate-50 px-2 py-2 text-center text-[10px] text-slate-400">
                            —
                          </div>
                        </td>
                      );
                    }

                    const allScores = batch.evaluation?.candidates.map(
                      (item) => Number(item.overall_score) || 0,
                    ) ?? [0];
                    const bestScore = Math.max(...allScores);
                    const candidateScore = Number(evaluationCandidate.overall_score) || 0;
                    const isBest = candidateScore === bestScore;

                    return (
                      <td key={`${candidate.id}-${batch.id}`} className="px-1.5 py-2 align-top">
                        <div
                          className={cn(
                            "space-y-1 rounded-xl border px-2 py-2 text-center",
                            isBest
                              ? "border-emerald-200 bg-emerald-50 shadow-[0_12px_30px_-26px_rgba(16,185,129,0.7)]"
                              : "border-border/80 bg-slate-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                isBest
                                  ? "bg-emerald-100 text-emerald-900"
                                  : "bg-slate-100 text-slate-600",
                              )}
                            >
                              #{evaluationCandidate.ranking_in_batch}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-[0.14em]",
                                isBest ? "text-emerald-700" : "text-slate-400",
                              )}
                            >
                              {isBest ? "Top" : "Score"}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "text-2xl font-semibold leading-none tracking-tight",
                              isBest ? "text-emerald-950" : "text-slate-950",
                            )}
                          >
                            {formatScore(evaluationCandidate.overall_score)}
                          </p>
                          <p className="line-clamp-2 text-[10px] leading-3.5 text-slate-500">
                            {summarizeShortFeedback(evaluationCandidate)}
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
              <th className="px-4 py-3 font-semibold">Judge</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
              <th className="px-4 py-3 font-semibold">Tokens</th>
              <th className="px-4 py-3 font-semibold">Cost</th>
              <th className="px-4 py-3 font-semibold">Global</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {run.global_summaries.map((summary) => {
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
              className="rounded-xl border border-border/80 bg-slate-50 p-3"
            >
              <p className="text-xs font-semibold text-slate-950">
                {model?.display_name ?? "Unknown model"}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">
                {summary.global_summary_text ?? "No global summary generated."}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <FeedbackBlock
                  icon={Sparkles}
                  label="Best patterns"
                  value={summary.best_patterns_text ?? "No repeated strengths captured."}
                />
                <FeedbackBlock
                  icon={Clock3}
                  label="Weak patterns"
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

function JudgeBatchPanel({
  isLoading,
  isStarting,
  isRetrying,
  onInspectBatch,
  retryingBatchIds,
  canStart,
  judging,
  onStart,
  onRetry,
  onRetryBatch,
  promptSnapshots,
  onSelectBatch,
  selectedBatchId,
}: {
  isLoading: boolean;
  isStarting: boolean;
  isRetrying: boolean;
  onInspectBatch: () => void;
  retryingBatchIds: number[];
  canStart: boolean;
  judging: RunJudging | undefined;
  onStart: () => void;
  onRetry: () => void;
  onRetryBatch: (batchId: number) => void;
  promptSnapshots: RunPromptSnapshot[];
  onSelectBatch: (batchId: number) => void;
  selectedBatchId: number | null;
}) {
  const isJudgingActive = isStarting || isRetrying || retryingBatchIds.length > 0;
  const absoluteItems = judging?.items.filter((item) => item.batch_type === "absolute") ?? [];
  const arenaItems = judging?.items.filter((item) => item.batch_type === "arena") ?? [];

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading judge jobs...</p>;
  }

  if (!judging || judging.items.length === 0) {
    return (
      <div className="flex h-full w-full flex-col justify-between gap-5">
        <div className="min-h-[7rem] rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-4 shadow-[0_8px_18px_-26px_rgba(15,23,42,0.18)]">
          <p className="text-[0.9rem] font-semibold tracking-tight text-slate-950">
            No judge jobs yet
          </p>
          <p className="mt-2 max-w-[28rem] text-[0.92rem] leading-6 text-slate-600">
            Phase 1 is complete. Start judging to run absolute review first, then targeted arena comparisons.
          </p>
        </div>
        <div className="flex w-full justify-center">
          <Button className="h-10 px-5" disabled={!canStart || isStarting} onClick={onStart} variant="secondary">
            {isStarting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Judging in progress…
              </>
            ) : (
              "Start judging"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isJudgingActive ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-amber-600" />
          <p className="text-sm font-medium text-amber-900">
            {isStarting || isRetrying ? "Running judge jobs…" : "Retrying job…"}
          </p>
        </div>
      ) : null}
      <button
        className="group flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(255,255,255,0.98))] px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-[linear-gradient(180deg,rgba(237,233,254,0.98),rgba(255,255,255,1))] hover:shadow-[0_18px_34px_-26px_rgba(139,92,246,0.25)]"
        onClick={onInspectBatch}
        type="button"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950 transition-colors duration-150 group-hover:text-violet-950">
            Full judge response
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Inspect the complete judge payload, raw response and parsed evaluation for the selected job.
          </p>
        </div>
        <Eye className="h-4 w-4 shrink-0 text-violet-600 transition-all duration-200 group-hover:scale-110 group-hover:text-violet-700" />
      </button>
      <div className="space-y-2">
        {absoluteItems.length > 0 ? (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Absolute Review
            </p>
            {absoluteItems.map((batch) => renderJudgeBatchRow({
              batch,
              promptSnapshots,
              retryingBatchIds,
              selectedBatchId,
              onRetryBatch,
              onSelectBatch,
              isJudgingActive,
            }))}
          </div>
        ) : null}
        {arenaItems.length > 0 ? (
          <div className="space-y-2">
            <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Arena Pairwise
            </p>
            {arenaItems.map((batch) => renderJudgeBatchRow({
              batch,
              promptSnapshots,
              retryingBatchIds,
              selectedBatchId,
              onRetryBatch,
              onSelectBatch,
              isJudgingActive,
            }))}
          </div>
        ) : null}
      </div>
      <Button disabled={isJudgingActive} onClick={onRetry} variant="secondary">
        Retry all failed
      </Button>
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
            ? "Judge is evaluating this prompt"
            : batch.status === "pending"
              ? "Judge job is queued"
              : "No parsed judge evaluation yet"
        }
        description={
          batch.error_message ??
          (batch.status === "running"
            ? "Results will appear here as soon as this prompt is completed."
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

function renderJudgeBatchRow({
  batch,
  promptSnapshots,
  retryingBatchIds,
  selectedBatchId,
  onRetryBatch,
  onSelectBatch,
  isJudgingActive,
}: {
  batch: JudgeBatch;
  promptSnapshots: RunPromptSnapshot[];
  retryingBatchIds: number[];
  selectedBatchId: number | null;
  onRetryBatch: (batchId: number) => void;
  onSelectBatch: (batchId: number) => void;
  isJudgingActive: boolean;
}) {
  const prompt = promptById(promptSnapshots, batch.prompt_snapshot_id);
  const isBatchRetrying = retryingBatchIds.includes(batch.id);
  const candidateCount = countJudgeBatchCandidates(batch);

  return (
    <div
      key={batch.id}
      className={cn(
        "group flex w-full cursor-pointer items-start justify-between gap-3 rounded-[1rem] border px-3 py-3 transition-all duration-200",
        selectedBatchId === batch.id
          ? "border-sky-300 bg-[linear-gradient(180deg,rgba(240,249,255,0.96),rgba(255,255,255,0.98))] shadow-[0_16px_36px_-28px_rgba(14,165,233,0.3)]"
          : "border-sky-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))] hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[linear-gradient(180deg,rgba(240,249,255,0.98),rgba(255,255,255,1))] hover:shadow-[0_16px_32px_-26px_rgba(14,165,233,0.24)]",
      )}
    >
      <button
        className="min-w-0 flex-1 rounded-[0.85rem] text-left outline-none transition-transform duration-150 active:scale-[0.995]"
        onClick={() => onSelectBatch(batch.id)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-950 transition-colors duration-150 group-hover:text-sky-900">
            {prompt?.name ?? `Prompt snapshot #${batch.prompt_snapshot_id}`}
          </p>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
              batch.batch_type === "arena"
                ? "bg-violet-100 text-violet-700"
                : "bg-sky-100 text-sky-700",
            )}
          >
            {batch.batch_type}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Job {batch.batch_index} · {candidateCount} candidate{candidateCount > 1 ? "s" : ""}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <Eye className="h-4 w-4 text-sky-700/70 transition-all duration-200 group-hover:scale-110 group-hover:text-sky-800" />
        {isBatchRetrying ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-500" />
        ) : null}
        <StatusPill status={isBatchRetrying ? "running" : batch.status} />
        {batch.status === "failed" && !isBatchRetrying ? (
          <Button
            disabled={isJudgingActive}
            onClick={(e) => {
              e.stopPropagation();
              onRetryBatch(batch.id);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Retry
          </Button>
        ) : null}
      </div>
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
    />
  );
}

function ScoreStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-2 text-center transition-all duration-200",
        scoreToneClasses(value, "soft"),
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 truncate">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold leading-none">{formatScore(value)}</p>
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

function CandidateFeedbackAccordion({
  candidate,
  model,
  onOpenResponse,
}: {
  candidate: JudgeEvaluationCandidate;
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
        <div className="grid items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white">
              {candidate.anonymized_candidate_label}
            </span>
            <p className="min-w-0 truncate text-sm font-semibold text-slate-950 transition-colors duration-150 group-hover:text-slate-700">
              {model?.display_name ?? "Candidate model"}
            </p>
            <MetaPill label={`Rank ${candidate.ranking_in_batch}`} />
            <span className="truncate text-xs text-slate-400">
              {model ? `${model.provider_type} / ${model.runtime_type}` : ""}
            </span>
          </div>
          <div
            className={cn(
              "justify-self-start rounded-lg border px-3 py-1.5 text-center md:justify-self-end",
              scoreToneClasses(candidate.overall_score, "soft"),
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Overall
            </p>
            <p className="mt-0.5 text-xl font-semibold leading-none">
              {formatScore(candidate.overall_score)}
            </p>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-[2.5rem_repeat(3,minmax(0,1fr))] gap-2 sm:grid-cols-[2.5rem_repeat(6,minmax(0,1fr))]">
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
          <ScoreStat label="Relevance" value={candidate.relevance_score} />
          <ScoreStat label="Accuracy" value={candidate.accuracy_score} />
          <ScoreStat label="Completeness" value={candidate.completeness_score} />
          <ScoreStat label="Clarity" value={candidate.clarity_score} />
          <ScoreStat label="Instruction" value={candidate.instruction_following_score} />
          <ScoreStat label="Confidence" value={candidate.judge_confidence_score ?? "—"} />
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

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-border/80 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-slate-950">{value}</p>
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

function countJudgeBatchCandidates(batch: JudgeBatch): number {
  if (batch.evaluation?.candidates.length) {
    return batch.evaluation.candidates.length;
  }

  try {
    const candidateIds = JSON.parse(batch.randomized_candidate_ids_jsonb);
    return Array.isArray(candidateIds) ? candidateIds.length : 0;
  } catch {
    return 0;
  }
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
