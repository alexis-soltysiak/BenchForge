import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
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
      <section className="relative overflow-hidden rounded-[1.65rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.16),_transparent_30%),linear-gradient(135deg,_rgba(255,244,245,0.92),_rgba(255,255,255,0.98)_44%,_rgba(255,255,255,0.96))] p-3.5 shadow-xl lg:p-4">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
        <div className="relative flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_31rem] xl:items-center xl:gap-4">
          <div className="max-w-[30rem] space-y-2">
            <span className="inline-flex rounded-full border border-rose-200 bg-white/85 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-700">
              Execution Monitor
            </span>
            <h1 className="font-display text-[1.8rem] font-semibold tracking-tight text-slate-950 lg:text-[2.2rem]">
              Runs
            </h1>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={Activity}
              label="Visible Runs"
              tone="red"
              value={String(visibleRuns.length)}
            />
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={CheckCircle2}
              label="Completed"
              tone="red"
              value={String(completedRuns)}
            />
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={SquareTerminal}
              label="Active Runs"
              tone="red"
              value={String(activeRuns)}
            />
            <MetricCard
              compact
              className="rounded-[1.2rem]"
              icon={Gavel}
              label="Reports Ready"
              tone="red"
              value={String(readyReports)}
            />
          </div>
        </div>
      </section>

      <section className="mt-5">
        <Card className="overflow-hidden border-border/70 bg-white/90 shadow-sm">
          <div className="border-b border-border/80 px-3 py-2.5 lg:px-3.5">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Runs List</h2>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="h-10 rounded-[1rem] pl-9 text-[0.95rem]"
                  placeholder="Search runs"
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
              resourceLabel="runs"
            />
          ) : null}

          <div className="divide-y divide-border/70">
            {runsQuery.isLoading ? (
              <div className="px-4 py-10 text-[0.92rem] text-slate-500">Loading runs...</div>
            ) : visibleRuns.length === 0 ? (
              <div className="px-4 py-7">
                <EmptyStatePanel
                  title="No runs found"
                  description="Launch a benchmark from the Sessions page to create the first immutable run snapshot."
                />
              </div>
            ) : (
              visibleRuns.map((item) => (
                <button
                  key={item.id}
                  className="block w-full px-3.5 py-3 text-left transition hover:bg-slate-50"
                  onClick={() => {
                    onOpenRun(item.id);
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.95rem] font-semibold text-slate-950">{item.name}</p>
                      <p className="mt-1 text-[0.92rem] text-slate-500">
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
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
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
        description="Embedded PDF preview of the generated benchmark report."
        onClose={() => setPreviewRun(null)}
        open={previewRun !== null}
        size="xl"
        title={previewRun ? `Report Preview · ${previewRun.name}` : "Report Preview"}
      >
        {previewRun ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-white">
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
    onSuccess: async () => {
      setFeedback("Judging started.");
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
  const responses = responsesQuery.data?.items ?? [];
  const selectedResponse = responses.find((item) => item.id === selectedResponseId) ?? null;
  const judging = judgingQuery.data;
  const selectedJudgeBatch =
    judging?.items.find((item) => item.id === selectedJudgeBatchId) ?? null;
  const candidateSnapshots = selectedRun
    ? selectedRun.model_snapshots.filter((item) => item.role === "candidate")
    : [];
  const expectedResponses = selectedRun
    ? selectedRun.prompt_snapshots.length * candidateSnapshots.length
    : 0;
  const completedCandidateResponses = responses.filter(
    (item) => item.status === "completed",
  ).length;
  const allCandidatesReady =
    expectedResponses > 0 &&
    responses.length === expectedResponses &&
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

  return (
    <div className="px-5 py-8 lg:px-10 lg:py-10">
      <div className="mb-6">
        <Button onClick={onBack} variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to runs
        </Button>
      </div>

      {selectedRun ? (
        <div className="space-y-6">
          <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                  Run #{selectedRun.id}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {selectedRun.name}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill status={selectedRun.status} />
                  <StatusPill
                    label={`report ${selectedRun.report_status}`}
                    status={selectedRun.report_status}
                  />
                  <InfoTag
                    label="Launched"
                    tone="slate"
                    value={formatDate(selectedRun.launched_at)}
                  />
                  <InfoTag
                    label="Completed"
                    tone={selectedRun.completed_at ? "emerald" : "amber"}
                    value={
                      selectedRun.completed_at
                        ? formatDate(selectedRun.completed_at)
                        : "In progress"
                    }
                  />
                  <InfoTag
                    label="Rubric"
                    tone="sky"
                    value={selectedRun.rubric_version}
                  />
                  <InfoTag
                    label="Snapshots"
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
                <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
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
              <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
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

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                  {candidateSnapshots.map((candidate) => (
                    <CandidateExecutionCard
                      key={candidate.id}
                      candidate={candidate}
                      localState={localNextQuery.data}
                      onConfirmReady={() => confirmLocalMutation.mutate()}
                      onStartCurrent={() => startLocalMutation.mutate()}
                      onStartEndpoint={() => handleStartRemoteCandidate(candidate.id)}
                      promptCount={selectedRun.prompt_snapshots.length}
                      responses={responses.filter((item) => item.model_snapshot_id === candidate.id)}
                      runStatus={selectedRun.status}
                      isConfirming={confirmLocalMutation.isPending}
                      isStartingEndpoint={startingRemoteIds.includes(candidate.id)}
                      isStarting={startLocalMutation.isPending}
                    />
                  ))}
                </div>
              </Card>

              <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
                <SectionHeading
                  title="Phase 1 · Responses By Prompt"
                  description="Une ligne = un prompt exécuté par un candidat. Clique une réponse pour ouvrir son inspection détaillée dans un grand modal."
                />
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-border/80 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Prompt</th>
                        <th className="px-4 py-3 font-semibold">Candidate</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Duration</th>
                        <th className="px-4 py-3 font-semibold">Tokens</th>
                        <th className="px-4 py-3 font-semibold">Cost</th>
                        <th className="px-4 py-3 font-semibold">Retries</th>
                        <th className="px-4 py-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {responsesQuery.isLoading ? (
                        <tr>
                          <td className="px-4 py-6 text-slate-500" colSpan={8}>
                            Loading candidate responses...
                          </td>
                        </tr>
                      ) : responses.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-slate-500" colSpan={8}>
                            No responses recorded yet. Candidate execution has not produced persisted outputs yet.
                          </td>
                        </tr>
                      ) : (
                        responses.map((response) => {
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
                                  "cursor-pointer transition hover:bg-slate-50",
                                  selectedResponseId === response.id && "bg-slate-50",
                                )}
                                onClick={() => {
                                  setSelectedResponseId(response.id);
                                  setIsResponseModalOpen(true);
                                }}
                              >
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-slate-950">{prompt?.name ?? "Unknown prompt"}</p>
                                  <p className="text-xs text-slate-500">{prompt?.category_name ?? "Unknown category"}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-slate-950">{model?.display_name ?? "Unknown model"}</p>
                                  <p className="text-xs text-slate-500">
                                    {model ? `${model.provider_type} / ${model.runtime_type}` : "Missing snapshot"}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {isRowLoading ? (
                                    <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500" />
                                  ) : response.status === "completed" ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                  ) : response.status === "failed" ? (
                                    <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                                  ) : (
                                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                                  )}
                                  <StatusPill status={response.status} />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {formatDuration(response.metric?.duration_ms)}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {response.metric?.total_tokens ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {formatCost(response.metric?.estimated_cost)}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{response.retry_count}</td>
                              <td className="px-4 py-3 text-right">
                                {["failed", "cancelled"].includes(response.status) ? (
                                  <Button
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
                                  <span className="text-xs text-slate-400">—</span>
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
                      prompt={
                        selectedJudgeBatch
                          ? promptById(
                              selectedRun.prompt_snapshots,
                              selectedJudgeBatch.prompt_snapshot_id,
                            )
                          : undefined
                      }
                      responses={responses}
                      run={selectedRun}
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
                    responses={responses}
                    run={selectedRun}
                  />
                  <AggregatedSummaryTable run={selectedRun} />
                </div>
              )}
            </Card>
          ) : null}
        </div>
      ) : runQuery.isLoading ? (
        <Card className="border-border/70 bg-white/95 p-6 shadow-sm">
          <p className="text-sm text-slate-500">Loading run details...</p>
        </Card>
      ) : (
        <Card className="border-border/70 bg-white/95 p-6 shadow-sm">
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
  label,
  tone,
  value,
}: {
  label: string;
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
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      <span className="uppercase tracking-[0.14em]">{label}</span>
      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
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
        wash: "bg-white",
        fill: "from-orange-100/90 via-orange-50/70 to-white/20",
        icon: "bg-orange-50 text-orange-700",
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
        wash: "bg-white",
        fill: "from-amber-100/90 via-amber-50/70 to-white/20",
        icon: "bg-amber-50 text-amber-700",
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
        wash: "bg-white",
        fill: "from-teal-100/90 via-teal-50/70 to-white/20",
        icon: "bg-teal-50 text-teal-700",
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
              "group relative overflow-hidden rounded-[1.6rem] border bg-white text-left transition duration-200",
              isActive
                ? cn(phase.tint.border, "shadow-[0_22px_48px_-28px_rgba(15,23,42,0.28)]")
                : "border-border/80 hover:border-slate-300",
              !phase.unlocked && "opacity-80",
            )}
            disabled={!phase.unlocked}
            onClick={() => onPhaseChange(phase.key)}
            type="button"
          >
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-300",
                phase.tint.wash,
                isActive ? "opacity-100" : "opacity-50",
              )}
            />
            <div
              className={cn(
                "absolute inset-y-0 left-0 bg-gradient-to-r transition-[width] duration-500 ease-out",
                phase.tint.fill,
              )}
              style={{ width: phase.stageFill }}
            />
            <div className="absolute inset-x-4 bottom-3 h-[4px] overflow-hidden rounded-full bg-slate-200/70">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  phase.tint.progress,
                )}
                style={{ width: progressWidth }}
              />
            </div>

            <div className="relative flex items-start justify-between gap-3 px-4 py-4 pb-7">
              <div className="space-y-2">
                <span
                  className={cn(
                    "inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm",
                    phase.tint.icon,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className={cn("text-base font-semibold", isActive ? phase.tint.text : "text-slate-950")}>
                    {phase.label}
                  </p>
                  <p className="text-sm text-slate-500">{phase.subtitle}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [detailSide, setDetailSide] = useState<"left" | "right">("right");
  const completedCount = responses.filter((item) => item.status === "completed").length;
  const runningCount = responses.filter((item) => item.status === "running").length;
  const failedCount = responses.filter((item) =>
    ["failed", "cancelled"].includes(item.status),
  ).length;
  const pendingCount = Math.max(promptCount - completedCount - failedCount, 0);
  const isLocal = candidate.runtime_type === "local";
  const isCurrentLocal = localState?.model_snapshot_id === candidate.id;
  const completionRatio = promptCount > 0 ? completedCount / promptCount : 0;
  const localInstructions =
    localState?.local_load_instructions || "No local load instructions were provided.";
  const startedCount = responses.filter(
    (item) => item.retry_count > 0 || item.status !== "pending",
  ).length;
  const updateDetailSide = () => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const midpoint = rect.left + rect.width / 2;
    setDetailSide(midpoint < window.innerWidth / 2 ? "right" : "left");
  };
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
    if (isLocal && pendingCount > 0) {
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
    <div
      ref={cardRef}
      className="group relative"
      onFocus={updateDetailSide}
      onMouseEnter={updateDetailSide}
    >
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

        <div className="mt-3 grid grid-cols-3 gap-2">
          <CompactMetric label="P" value={String(promptCount)} />
          <CompactMetric label="Run" value={String(runningCount)} />
          <CompactMetric label="Left" value={String(pendingCount)} />
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
              Start
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

        <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-slate-400">
          <span>{isLocal ? "Hover for handoff" : "Hover for endpoint"}</span>
          <span>{failedCount > 0 ? `${failedCount} failed` : "details"}</span>
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute z-30 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
          "left-0 right-0 top-full mt-2",
          "md:top-1/2 md:mt-0 md:w-[34rem] md:-translate-y-1/2",
          detailSide === "right"
            ? "md:left-full md:right-auto md:ml-3"
            : "md:right-full md:left-auto md:mr-3",
        )}
      >
        <div className="rounded-[1.3rem] border border-slate-200 bg-white/98 p-4 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-950/5 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">
                {candidate.display_name}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isLocal
                  ? "Local candidate. Load it in LM Studio, confirm readiness, then start the current handoff."
                  : "Remote candidate. Endpoint execution can run in parallel with every other remote candidate."}
              </p>
            </div>
            <StatusPill status={candidateStatus.status} label={candidateStatus.label} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <CompactDetail label="Prompts" value={String(promptCount)} />
                <CompactDetail label="Completed" value={String(completedCount)} />
                <CompactDetail label="Running" value={String(runningCount)} />
                <CompactDetail label="Remaining" value={String(pendingCount)} />
              </div>
              <CompactDetail
                label="Machine"
                value={
                  isLocal && isCurrentLocal && localState
                    ? localState.machine_label ?? "Current machine"
                    : candidate.machine_label ?? "Managed endpoint"
                }
              />
            </div>

            <div className="space-y-3">
              <CompactDetail
                label="Endpoint"
                value={
                  isLocal && isCurrentLocal && localState
                    ? localState.endpoint_url
                    : candidate.endpoint_url
                }
              />
              <CompactDetail label="Model ID" value={candidate.model_identifier} />

              {isLocal ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                    LM Studio Instructions
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    {isCurrentLocal && localState
                      ? localInstructions
                      : "This local candidate is queued and will expose its handoff details when it becomes the active local model."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {isLocal && isCurrentLocal ? (
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                disabled={isConfirming}
                onClick={onConfirmReady}
                size="sm"
                variant="secondary"
              >
                Confirm ready
              </Button>
              <Button
                className="flex-1"
                disabled={!localState?.confirmed_ready || isStarting}
                onClick={onStartCurrent}
                size="sm"
              >
                Start current model
              </Button>
            </div>
          ) : !isLocal ? (
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                disabled={isStartingEndpoint || completedCount === promptCount}
                onClick={onStartEndpoint}
                size="sm"
                variant="secondary"
              >
                {completedCount === promptCount ? "Completed" : isStartingEndpoint ? "Starting endpoint" : "Start endpoint"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function CompactDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-900">{value}</p>
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
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {label}
    </span>
  );
}

function StatusPill({ label, status }: { label?: string; status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize",
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
  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryStat label="Prompt" value={prompt?.name ?? "Unknown prompt"} />
        <SummaryStat label="Candidate" value={model?.display_name ?? "Unknown model"} />
      </div>

      <div className="rounded-[1.25rem] border border-border/80 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Normalized Response
        </p>
        <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
          {response.normalized_response_text || "No normalized response recorded yet."}
        </pre>
      </div>

      {response.error_message ? (
        <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
            Error
          </p>
          <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-rose-900">
            {response.error_message}
          </pre>
        </div>
      ) : null}

      <div className="rounded-[1.25rem] border border-border/80 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Request Payload
        </p>
        <pre className="mt-3 overflow-x-auto text-sm leading-6 text-slate-700">
          {response.request_payload_jsonb || "No payload persisted yet."}
        </pre>
      </div>
    </div>
  );
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
  const completedBatches =
    judging?.items.filter((batch) => batch.status === "completed" && batch.evaluation) ?? [];
  const candidates = run.model_snapshots.filter((item) => item.role === "candidate");

  if (completedBatches.length === 0 || candidates.length === 0) {
    return (
      <EmptyStatePanel
        title="No prompt ranking yet"
        description="Prompt-by-prompt ranking becomes available after judge batches complete."
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Prompt Ranking Matrix"
        description="Une colonne par prompt. Le meilleur score de chaque prompt ressort visuellement dans la matrice."
      />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border/80 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold">
                Candidate
              </th>
              {completedBatches.map((batch) => {
                const prompt = promptById(run.prompt_snapshots, batch.prompt_snapshot_id);
                const topScore = Math.max(
                  ...batch.evaluation!.candidates.map((item) => Number(item.overall_score) || 0),
                );

                return (
                  <th key={batch.id} className="min-w-[12rem] px-4 py-3 font-semibold">
                    <div>
                      <p className="font-semibold text-slate-700">
                        {prompt?.name ?? `Prompt #${batch.prompt_snapshot_id}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Best score {formatScore(String(topScore))}
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
                <td className="sticky left-0 z-10 bg-white px-4 py-4">
                  <div>
                    <p className="font-medium text-slate-950">{candidate.display_name}</p>
                    <p className="text-xs text-slate-500">
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
                      <td key={`${candidate.id}-${batch.id}`} className="px-4 py-4">
                        <span className="text-xs text-slate-400">No score</span>
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
                    <td key={`${candidate.id}-${batch.id}`} className="px-4 py-4 align-top">
                      <div
                        className={cn(
                          "grid min-h-[11rem] grid-rows-[auto_auto_1fr] rounded-[1rem] border p-4",
                          isBest
                            ? "border-emerald-200 bg-emerald-50 shadow-[0_16px_36px_-28px_rgba(16,185,129,0.55)]"
                            : "border-border/80 bg-slate-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Score
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-4xl font-semibold leading-none tracking-tight",
                                isBest ? "text-emerald-950" : "text-slate-950",
                              )}
                            >
                              {formatScore(evaluationCandidate.overall_score)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex min-w-[3.75rem] items-center justify-center rounded-full px-3 py-1.5 text-base font-semibold",
                              isBest
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-slate-100 text-slate-600",
                            )}
                          >
                            #{evaluationCandidate.ranking_in_batch}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "mt-4 text-xs font-semibold uppercase tracking-[0.18em]",
                            isBest ? "text-emerald-700" : "text-slate-400",
                          )}
                        >
                          {isBest ? "Best score" : "Ranked"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {evaluationCandidate.short_feedback ?? "No short feedback."}
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

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading judge batches...</p>;
  }

  if (!judging || judging.items.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyStatePanel
          title="No judge batches yet"
          description="Phase 1 is complete. Start judging manually to create one judge batch per prompt."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!canStart || isStarting} onClick={onStart} variant="secondary">
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
            {isStarting || isRetrying ? "Running all judge batches…" : "Retrying batch…"}
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat label="Completed" value={String(judging.completed_batches)} />
        <SummaryStat label="Failed" value={String(judging.failed_batches)} />
        <SummaryStat label="Pending" value={String(judging.pending_batches)} />
      </div>
      <div className="space-y-2">
        {judging.items.map((batch) => {
          const prompt = promptById(promptSnapshots, batch.prompt_snapshot_id);
          const isBatchRetrying = retryingBatchIds.includes(batch.id);

          return (
            <div
              key={batch.id}
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-[1rem] border px-3 py-3 transition",
                selectedBatchId === batch.id
                  ? "border-slate-200 bg-slate-50"
                  : "border-border/80 bg-slate-50",
              )}
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelectBatch(batch.id)}
                type="button"
              >
                <p className="text-sm font-medium text-slate-950">
                  {prompt?.name ?? `Prompt snapshot #${batch.prompt_snapshot_id}`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Batch {batch.batch_index} · {batch.evaluation?.candidates.length ?? 0} candidates
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-2">
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
        })}
      </div>
      <Button disabled={isJudgingActive} onClick={onRetry} variant="secondary">
        Retry all failed
      </Button>
    </div>
  );
}

function JudgeFeedbackPanel({
  batch,
  prompt,
  responses,
  run,
}: {
  batch: JudgeBatch | null;
  prompt: RunPromptSnapshot | undefined;
  responses: CandidateResponse[];
  run: Run;
}) {
  if (!batch) {
    return (
      <EmptyStatePanel
        title="Select a judge batch"
        description="Choose one batch to inspect rankings, criterion scores, and written feedback."
      />
    );
  }

  if (!batch.evaluation) {
    return (
      <EmptyStatePanel
        title="No parsed judge evaluation yet"
        description={batch.error_message ?? "The selected batch has not completed."}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.4rem] border border-border/80 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {prompt?.name ?? "Unknown prompt"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {prompt?.category_name ?? "Unknown category"} · schema{" "}
              {batch.evaluation.schema_version}
            </p>
          </div>
          <StatusPill status={batch.status} />
        </div>
      </div>

      <div className="space-y-3">
        {batch.evaluation.candidates.map((candidate) => (
          <JudgeCandidateCard
            key={candidate.id}
            candidate={candidate}
            response={responses.find((item) => item.id === candidate.candidate_response_id)}
            run={run}
          />
        ))}
      </div>
    </div>
  );
}

function JudgeCandidateCard({
  candidate,
  response,
  run,
}: {
  candidate: JudgeEvaluationCandidate;
  response: CandidateResponse | undefined;
  run: Run;
}) {
  const model = response ? modelById(run.model_snapshots, response.model_snapshot_id) : undefined;

  return (
    <div className="rounded-xl border border-border/80 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white">
            {candidate.anonymized_candidate_label}
          </span>
          <p className="text-sm font-semibold text-slate-950">
            {model?.display_name ?? "Candidate model"}
          </p>
          <MetaPill label={`Rank ${candidate.ranking_in_batch}`} />
          <span className="text-xs text-slate-400">
            {model ? `${model.provider_type} / ${model.runtime_type}` : ""}
          </span>
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-1.5 text-center",
            scoreToneClasses(candidate.overall_score, "soft"),
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Overall</p>
          <p className="text-xl font-semibold leading-none mt-0.5">
            {formatScore(candidate.overall_score)}
          </p>
        </div>
      </div>

      <div className="mt-2.5 grid gap-2 grid-cols-3 sm:grid-cols-6">
        <ScoreStat label="Relevance" value={candidate.relevance_score} />
        <ScoreStat label="Accuracy" value={candidate.accuracy_score} />
        <ScoreStat label="Completeness" value={candidate.completeness_score} />
        <ScoreStat label="Clarity" value={candidate.clarity_score} />
        <ScoreStat label="Instruction" value={candidate.instruction_following_score} />
        <ScoreStat label="Confidence" value={candidate.judge_confidence_score ?? "—"} />
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
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

      <div className="mt-2.5 space-y-2">
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
  );
}

function ScoreStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-2 text-center",
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
    <div className="rounded-lg border border-border/80 bg-slate-50 p-2.5">
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
