import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  Gavel,
  LoaderCircle,
  Play,
  Search,
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import {
  confirmLocalReady,
  fetchLocalNext,
  fetchRun,
  fetchRunJudging,
  fetchRunResponses,
  fetchRuns,
  generateRunReport,
  resumeRun,
  retryRunJudging,
  startLocalCurrent,
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
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type RunsPageProps = {
  initialRunId?: number | null;
};

const terminalStatuses = new Set(["completed", "failed", "cancelled"]);

export function RunsPage({ initialRunId = null }: RunsPageProps) {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(initialRunId);
  const [search, setSearch] = useState("");
  const [selectedResponseId, setSelectedResponseId] = useState<number | null>(null);
  const [selectedJudgeBatchId, setSelectedJudgeBatchId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: fetchRuns,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (initialRunId) {
      setSelectedRunId(initialRunId);
    }
  }, [initialRunId]);

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

  useEffect(() => {
    if (selectedRunId !== null) {
      return;
    }

    const firstRun = visibleRuns[0] ?? runsQuery.data?.items[0];
    if (firstRun) {
      setSelectedRunId(firstRun.id);
    }
  }, [runsQuery.data?.items, selectedRunId, visibleRuns]);

  const runQuery = useQuery({
    queryKey: ["runs", selectedRunId],
    queryFn: () => fetchRun(selectedRunId as number),
    enabled: selectedRunId !== null,
    refetchInterval: (query) => {
      const run = query.state.data as Run | undefined;
      return run && !terminalStatuses.has(run.status) ? 4000 : false;
    },
  });

  const responsesQuery = useQuery({
    queryKey: ["runs", selectedRunId, "responses"],
    queryFn: () => fetchRunResponses(selectedRunId as number),
    enabled: selectedRunId !== null,
    refetchInterval: () =>
      runQuery.data && !terminalStatuses.has(runQuery.data.status) ? 4000 : false,
  });

  const hasLocalCandidates =
    runQuery.data?.model_snapshots.some(
      (item) => item.role === "candidate" && item.runtime_type === "local",
    ) ?? false;

  const localNextQuery = useQuery({
    queryKey: ["runs", selectedRunId, "local-next"],
    queryFn: () => fetchLocalNext(selectedRunId as number),
    enabled: selectedRunId !== null && hasLocalCandidates,
    refetchInterval: () =>
      runQuery.data && !terminalStatuses.has(runQuery.data.status) ? 4000 : false,
  });

  const judgingQuery = useQuery({
    queryKey: ["runs", selectedRunId, "judging"],
    queryFn: () => fetchRunJudging(selectedRunId as number),
    enabled: selectedRunId !== null,
    refetchInterval: () =>
      runQuery.data && !terminalStatuses.has(runQuery.data.status) ? 4000 : false,
  });

  useEffect(() => {
    const items = responsesQuery.data?.items ?? [];
    if (items.length === 0) {
      setSelectedResponseId(null);
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
    if (selectedRunId === null) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["runs"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", selectedRunId] }),
      queryClient.invalidateQueries({ queryKey: ["runs", selectedRunId, "responses"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", selectedRunId, "local-next"] }),
      queryClient.invalidateQueries({ queryKey: ["runs", selectedRunId, "judging"] }),
    ]);
  };

  const resumeMutation = useMutation({
    mutationFn: (runId: number) => resumeRun(runId),
    onSuccess: async () => {
      setFeedback("Remote candidates resumed.");
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to resume run.");
    },
  });

  const confirmLocalMutation = useMutation({
    mutationFn: (runId: number) => confirmLocalReady(runId),
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
    mutationFn: (runId: number) => startLocalCurrent(runId),
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
  const retryJudgingMutation = useMutation({
    mutationFn: (runId: number) => retryRunJudging(runId),
    onSuccess: async () => {
      setFeedback("Judging retried.");
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to retry judging.");
    },
  });
  const generateReportMutation = useMutation({
    mutationFn: (runId: number) => generateRunReport(runId),
    onSuccess: async () => {
      setFeedback("HTML report generated.");
      await refreshRunData();
    },
    onError: (error) => {
      setFeedback(error instanceof ApiError ? error.message : "Unable to generate report.");
    },
  });

  const selectedRun = runQuery.data;
  const responses = responsesQuery.data?.items ?? [];
  const selectedResponse = responses.find((item) => item.id === selectedResponseId) ?? null;
  const judging = judgingQuery.data;
  const selectedJudgeBatch =
    judging?.items.find((item) => item.id === selectedJudgeBatchId) ?? null;

  return (
    <div className="px-5 py-8 lg:px-10 lg:py-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.18),_transparent_32%),linear-gradient(135deg,_rgba(255,239,239,0.98),_rgba(255,255,255,0.96))] p-6 shadow-xl lg:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
        <div className="relative flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1fr)_48rem] xl:items-end">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-950">
              Execution Monitor
            </span>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
                Runs
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Track benchmark progress, inspect candidate outputs, and guide local
                execution when an operator needs to take over.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              compact
              icon={Activity}
              label="Visible Runs"
              tone="red"
              value={String(visibleRuns.length)}
            />
            <MetricCard
              compact
              icon={Bot}
              label="Responses"
              tone="red"
              value={String(selectedRun?.candidate_response_count ?? 0)}
            />
            <MetricCard
              compact
              icon={SquareTerminal}
              label="Local Queue"
              tone="red"
              value={String(localNextQuery.data?.pending_prompt_count ?? 0)}
            />
            <MetricCard
              compact
              icon={Gavel}
              label="Judge Batches"
              tone="red"
              value={String(judging?.completed_batches ?? 0)}
            />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[0.88fr_1.52fr]">
        <Card className="overflow-hidden border-border/70 bg-white/90 shadow-sm">
          <div className="border-b border-border/80 px-5 py-4">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold text-red-800">Runs List</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Browse immutable run snapshots and reopen their operational detail.
                </p>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search runs"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="divide-y divide-border/70">
            {runsQuery.isLoading ? (
              <div className="px-5 py-12 text-sm text-slate-500">Loading runs...</div>
            ) : visibleRuns.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyStatePanel
                  title="No runs found"
                  description="Launch a benchmark from the Sessions page to create the first immutable run snapshot."
                />
              </div>
            ) : (
              visibleRuns.map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "block w-full px-5 py-4 text-left transition hover:bg-red-50/70",
                    selectedRunId === item.id && "bg-red-50",
                  )}
                  onClick={() => {
                    setSelectedRunId(item.id);
                    setFeedback(null);
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Session #{item.session_id} · {item.prompt_count} prompts ·{" "}
                        {item.model_count} models
                      </p>
                    </div>
                    <StatusPill status={item.status} />
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

        {selectedRun ? (
          <div className="space-y-6">
            <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    Run detail
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {selectedRun.name}
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill status={selectedRun.status} />
                    <StatusPill label={`report ${selectedRun.report_status}`} status={selectedRun.report_status} />
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
                    onClick={() => resumeMutation.mutate(selectedRun.id)}
                    variant="secondary"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {selectedRun.candidate_response_count === 0 ? "Launch candidates" : "Resume remote"}
                  </Button>
                </div>
              </div>

              {feedback ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
                  {feedback}
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryStat label="Launched" value={formatDate(selectedRun.launched_at)} />
                <SummaryStat
                  label="Completed"
                  value={selectedRun.completed_at ? formatDate(selectedRun.completed_at) : "In progress"}
                />
                <SummaryStat label="Rubric" value={selectedRun.rubric_version} />
                <SummaryStat
                  label="Snapshots"
                  value={`${selectedRun.prompt_snapshots.length + selectedRun.model_snapshots.length} records`}
                />
              </div>
            </Card>

            <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
              <SectionHeading
                title="Progress Timeline"
                description="Run phases are derived from persisted run and report statuses."
              />
              <div className="mt-5 grid gap-3 lg:grid-cols-5">
                {buildTimeline(selectedRun, localNextQuery.data).map((step) => (
                  <div
                    key={step.title}
                    className={cn(
                      "rounded-[1.4rem] border px-4 py-4",
                      step.state === "done" && "border-red-200 bg-red-50",
                      step.state === "active" && "border-amber-200 bg-amber-50",
                      step.state === "pending" && "border-border/80 bg-slate-50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {step.state === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-red-600" />
                      ) : step.state === "active" ? (
                        <LoaderCircle className="h-4 w-4 animate-spin text-amber-600" />
                      ) : (
                        <Clock3 className="h-4 w-4 text-slate-400" />
                      )}
                      <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{step.description}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
              <SectionHeading
                title="Candidate Response Status"
                description="Every candidate response row is tracked independently by prompt snapshot and model snapshot."
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {responsesQuery.isLoading ? (
                      <tr>
                        <td className="px-4 py-6 text-slate-500" colSpan={7}>
                          Loading candidate responses...
                        </td>
                          </tr>
                    ) : responses.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-slate-500" colSpan={7}>
                          No responses recorded yet. Candidate execution has not produced persisted outputs yet.
                        </td>
                      </tr>
                    ) : (
                      responses.map((response) => {
                        const prompt = promptById(selectedRun.prompt_snapshots, response.prompt_snapshot_id);
                        const model = modelById(selectedRun.model_snapshots, response.model_snapshot_id);

                        return (
                          <tr
                            key={response.id}
                            className={cn(
                              "cursor-pointer transition hover:bg-red-50/60",
                              selectedResponseId === response.id && "bg-red-50",
                            )}
                            onClick={() => setSelectedResponseId(response.id)}
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
                              <StatusPill status={response.status} />
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
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
              <SectionHeading
                title="Aggregated Summaries"
                description="Candidate-level aggregate scores, technical summaries, and the composite global score."
              />
              <div className="mt-5">
                <AggregatedSummaryTable
                  run={selectedRun}
                />
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
                <SectionHeading
                  title="Selected Response"
                  description="Inspect the normalized output, payload metadata, and any failure details."
                />
                {selectedResponse ? (
                  <ResponseInspector
                    model={modelById(selectedRun.model_snapshots, selectedResponse.model_snapshot_id)}
                    prompt={promptById(selectedRun.prompt_snapshots, selectedResponse.prompt_snapshot_id)}
                    response={selectedResponse}
                  />
                ) : (
                  <p className="mt-5 text-sm text-slate-500">Select a response row to inspect details.</p>
                )}
              </Card>

              <div className="space-y-6">
                <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
                  <SectionHeading
                    title="Local Operator Panel"
                    description="Load the requested local model, confirm readiness, then start the current local batch."
                  />
                  <div className="mt-5">
                    <LocalOperatorPanel
                      hasLocalCandidates={hasLocalCandidates}
                      isConfirming={confirmLocalMutation.isPending}
                      isLoading={localNextQuery.isLoading}
                      isStarting={startLocalMutation.isPending}
                      localState={localNextQuery.data}
                      onConfirmReady={() => confirmLocalMutation.mutate(selectedRun.id)}
                      onStartCurrent={() => startLocalMutation.mutate(selectedRun.id)}
                    />
                  </div>
                </Card>

                <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
                  <SectionHeading
                    title="Judge Batches"
                    description="Track per-prompt judge execution and retry failed or missing batches."
                  />
                  <div className="mt-5">
                    <JudgeBatchPanel
                      isLoading={judgingQuery.isLoading}
                      isRetrying={retryJudgingMutation.isPending}
                      judging={judging}
                      onRetry={() => retryJudgingMutation.mutate(selectedRun.id)}
                      onSelectBatch={setSelectedJudgeBatchId}
                      selectedBatchId={selectedJudgeBatchId}
                    />
                  </div>
                </Card>

                <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
                  <SectionHeading
                    title="Judge Feedback"
                    description="Display per-prompt judged scores, rankings, and written feedback for the selected batch."
                  />
                  <div className="mt-5">
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
                </Card>

                <Card className="border-border/70 bg-white/95 p-5 shadow-sm">
                  <SectionHeading
                    title="Report Generation"
                    description="HTML and PDF artifacts become available once aggregation and reporting complete."
                  />
                  <div className="mt-5 space-y-3">
                    <Button
                      disabled={generateReportMutation.isPending}
                      onClick={() => generateReportMutation.mutate(selectedRun.id)}
                      variant="secondary"
                    >
                      Generate report artifacts
                    </Button>
                    <ReportRow label="Report status" value={selectedRun.report_status} />
                    <ReportRow label="HTML path" value={selectedRun.html_report_path ?? "Pending"} />
                    <ReportRow label="PDF path" value={selectedRun.pdf_report_path ?? "Pending"} />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <Card className="border-border/70 bg-white/95 p-6 shadow-sm">
            <EmptyStatePanel
              title="Select a run"
              description="Pick a run from the list to inspect execution, judging, aggregation, and report artifacts."
            />
          </Card>
        )}
      </section>
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
        status === "completed" && "bg-red-100 text-red-900",
        ["running", "running_candidates", "waiting_local", "judging", "aggregating", "reporting"].includes(status) &&
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

      <div className="grid gap-4 lg:grid-cols-2">
        {run.global_summaries.map((summary) => {
          const model = modelById(run.model_snapshots, summary.model_snapshot_id);
          return (
            <div
              key={`detail-${summary.id}`}
              className="rounded-[1.4rem] border border-border/80 bg-slate-50 p-4"
            >
              <p className="text-sm font-semibold text-slate-950">
                {model?.display_name ?? "Unknown model"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {summary.global_summary_text ?? "No global summary generated."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

function LocalOperatorPanel({
  hasLocalCandidates,
  isConfirming,
  isLoading,
  isStarting,
  localState,
  onConfirmReady,
  onStartCurrent,
}: {
  hasLocalCandidates: boolean;
  isConfirming: boolean;
  isLoading: boolean;
  isStarting: boolean;
  localState: LocalExecutionNextResponse | null | undefined;
  onConfirmReady: () => void;
  onStartCurrent: () => void;
}) {
  if (!hasLocalCandidates) {
    return (
      <EmptyStatePanel
        title="No local candidates"
        description="This run can execute fully remotely, so no operator handoff is required."
      />
    );
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading local execution queue...</p>;
  }

  if (!localState) {
    return (
      <EmptyStatePanel
        title="No local work remains"
        description="All queued local prompts have already been completed for this run."
        tone="success"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.4rem] border border-border/80 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-950">{localState.display_name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {localState.provider_type} · {localState.runtime_type} · {localState.model_identifier}
            </p>
          </div>
          <StatusPill
            status={localState.confirmed_ready ? "running" : "pending"}
            label={localState.confirmed_ready ? "ready confirmed" : "awaiting operator"}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryStat
            label="Endpoint"
            value={localState.endpoint_url}
          />
          <SummaryStat
            label="Machine"
            value={localState.machine_label ?? "Current machine"}
          />
        </div>

        <div className="mt-4 rounded-[1rem] border border-border/80 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Load Instructions
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {localState.local_load_instructions || "No local load instructions were provided."}
          </p>
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-border/80 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Pending prompt queue</p>
            <p className="mt-1 text-sm text-slate-500">
              {localState.pending_prompt_count} prompts remain for this local model.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button disabled={isConfirming} onClick={onConfirmReady} variant="secondary">
              Confirm ready
            </Button>
            <Button
              disabled={!localState.confirmed_ready || isStarting}
              onClick={onStartCurrent}
            >
              Start current model
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {localState.prompts.map((item) => (
            <div
              key={item.prompt_snapshot_id}
              className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/80 bg-slate-50 px-3 py-3"
            >
              <p className="text-sm font-medium text-slate-950">{item.prompt_name}</p>
              <StatusPill status={item.response_status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JudgeBatchPanel({
  isLoading,
  isRetrying,
  judging,
  onRetry,
  onSelectBatch,
  selectedBatchId,
}: {
  isLoading: boolean;
  isRetrying: boolean;
  judging: RunJudging | undefined;
  onRetry: () => void;
  onSelectBatch: (batchId: number) => void;
  selectedBatchId: number | null;
}) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading judge batches...</p>;
  }

  if (!judging || judging.items.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyStatePanel
          title="No judge batches yet"
          description="Judging starts after all candidate responses have been collected."
        />
        <Button disabled={isRetrying} onClick={onRetry} variant="secondary">
          Retry judging
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat label="Completed" value={String(judging.completed_batches)} />
        <SummaryStat label="Failed" value={String(judging.failed_batches)} />
        <SummaryStat label="Pending" value={String(judging.pending_batches)} />
      </div>
      <div className="space-y-2">
        {judging.items.map((batch) => (
          <button
            key={batch.id}
            className={cn(
              "flex w-full items-start justify-between gap-3 rounded-[1rem] border px-3 py-3 text-left transition hover:bg-red-50/60",
              selectedBatchId === batch.id
                ? "border-red-200 bg-red-50"
                : "border-border/80 bg-slate-50",
            )}
            onClick={() => onSelectBatch(batch.id)}
            type="button"
          >
            <div>
              <p className="text-sm font-medium text-slate-950">
                Prompt snapshot #{batch.prompt_snapshot_id}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Batch {batch.batch_index} · {batch.evaluation?.candidates.length ?? 0} candidates
              </p>
            </div>
            <StatusPill status={batch.status} />
          </button>
        ))}
      </div>
      <Button disabled={isRetrying} onClick={onRetry} variant="secondary">
        Retry judging
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
    <div className="rounded-[1.4rem] border border-border/80 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
              {candidate.anonymized_candidate_label}
            </span>
            <p className="text-sm font-semibold text-slate-950">
              {model?.display_name ?? "Candidate model"}
            </p>
            <MetaPill label={`Rank ${candidate.ranking_in_batch}`} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {model
              ? `${model.provider_type} / ${model.runtime_type}`
              : "Model snapshot unavailable"}
          </p>
        </div>
        <div
          className={cn(
            "rounded-[1rem] border px-4 py-3 text-center",
            scoreToneClasses(candidate.overall_score, "soft"),
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">
            Overall
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {formatScore(candidate.overall_score)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ScoreStat label="Relevance" value={candidate.relevance_score} />
        <ScoreStat label="Accuracy" value={candidate.accuracy_score} />
        <ScoreStat label="Completeness" value={candidate.completeness_score} />
        <ScoreStat label="Clarity" value={candidate.clarity_score} />
        <ScoreStat label="Instruction" value={candidate.instruction_following_score} />
        <ScoreStat label="Confidence" value={candidate.judge_confidence_score ?? "—"} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

      <div className="mt-4 space-y-3">
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
        "rounded-[1rem] border px-3 py-3",
        scoreToneClasses(value, "soft"),
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold">{formatScore(value)}</p>
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
    <div className="rounded-[1rem] border border-border/80 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-800">{value}</p>
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
          ? "border-red-200 bg-red-50"
          : "border-border/80 bg-slate-50",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          tone === "success" ? "text-red-950" : "text-slate-950",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mt-2 text-sm",
          tone === "success" ? "text-red-900" : "text-slate-600",
        )}
      >
        {description}
      </p>
    </div>
  );
}

function buildTimeline(run: Run, localState: LocalExecutionNextResponse | null | undefined) {
  const hasLocalCandidates = run.model_snapshots.some(
    (item) => item.role === "candidate" && item.runtime_type === "local",
  );
  const afterCandidates = [
    "waiting_local",
    "judging",
    "aggregating",
    "reporting",
    "completed",
    "failed",
    "cancelled",
  ].includes(run.status);
  const afterLocal = ["judging", "aggregating", "reporting", "completed"].includes(run.status);
  const afterJudging = ["aggregating", "reporting", "completed"].includes(run.status);
  const afterReporting = ["completed"].includes(run.status) || run.report_status === "completed";

  return [
    {
      title: "Snapshot",
      state: "done",
      description: "Session prompts and models have been frozen into this run snapshot.",
    },
    {
      title: "Candidates",
      state: run.status === "running_candidates" ? "active" : afterCandidates ? "done" : "pending",
      description: "Remote candidates execute automatically and persist response metrics.",
    },
    {
      title: "Local Operator",
      state: hasLocalCandidates
        ? run.status === "waiting_local"
          ? "active"
          : afterLocal && !localState
            ? "done"
            : "pending"
        : "done",
      description: hasLocalCandidates
        ? "Manual operator steps unblock local model execution one model at a time."
        : "No local candidates are attached to this run.",
    },
    {
      title: "Judging",
      state: run.status === "judging" ? "active" : afterJudging ? "done" : "pending",
      description: "Judge batches evaluate anonymized candidate outputs after collection completes.",
    },
    {
      title: "Reporting",
      state: run.status === "reporting" ? "active" : afterReporting ? "done" : "pending",
      description: "Aggregation and report artifact generation prepare HTML and PDF output.",
    },
  ] as const;
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
      ? "bg-red-100 text-red-900"
      : "border-red-200 bg-red-50 text-red-950";
  }
  if (parsed >= 70) {
    return variant === "badge"
      ? "bg-red-100 text-red-900"
      : "border-red-200 bg-red-50 text-red-950";
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
