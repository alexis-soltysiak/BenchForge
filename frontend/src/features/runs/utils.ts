import type {
  CandidateResponse,
  JudgeBatch,
  JudgeEvaluationCandidate,
  Run,
  RunGlobalSummary,
  RunJudging,
  RunModelSnapshot,
  RunPromptSnapshot,
} from "./types";

export function isServiceAvailabilityError(message: string | null): boolean {
  if (!message) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("database unavailable") ||
    normalizedMessage.includes("backend unavailable")
  );
}

export function getTopRunListSummaries(run: Run, limit: number): RunGlobalSummary[] {
  return [...run.global_summaries]
    .sort(
    (a, b) => Number(b.final_global_score ?? "-1") - Number(a.final_global_score ?? "-1"),
    )
    .slice(0, limit);
}

export function formatRunListDateTimeShort(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRunListElapsed(startedAt: string, completedAt: string): string {
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

export function formatRunListLatency(value: number | null): string {
  if (value === null) {
    return "latence —";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} s`;
  }
  return `${value} ms`;
}

export function formatRunListCost(value: string | null): string {
  if (!value) {
    return "coût —";
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return `coût ${value}`;
  }
  return `coût $${numericValue.toFixed(3)}`;
}

export function formatRunListScore(value: string | null): string {
  if (!value) {
    return "—";
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  return numericValue.toFixed(2);
}

export function promptById(items: RunPromptSnapshot[], id: number) {
  return items.find((item) => item.id === id);
}

export function modelById(items: RunModelSnapshot[], id: number) {
  return items.find((item) => item.id === id);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function consolidateCandidateResponses(responses: CandidateResponse[]): CandidateResponse[] {
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

export function isMoreRecentCandidateResponse(
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

export function candidateResponseTimestamp(response: CandidateResponse): number {
  const value = response.completed_at ?? response.started_at;
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatDuration(value: number | null | undefined): string {
  if (!value) {
    return "—";
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(2)} s`;
}

export function formatCost(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return `$${Number(value).toFixed(4)}`;
}

export function formatScore(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(0) : value;
}

export function summarizeShortFeedback(candidate: JudgeEvaluationCandidate): string {
  const text = candidate.short_feedback?.replace(/\s+/g, " ").trim();

  if (!text) {
    return "No summary";
  }

  if (text.length <= 44) {
    return text;
  }

  return `${text.slice(0, 41).trimEnd()}…`;
}

export function scoreToneClasses(
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

export function buildOptimisticJudging(run: Run): RunJudging {
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
      estimated_cost: null,
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

export function parseBatchCandidateIds(batch: JudgeBatch): number[] {
  try {
    const ids = JSON.parse(batch.randomized_candidate_ids_jsonb);
    return Array.isArray(ids) ? ids.map(Number) : [];
  } catch {
    return [];
  }
}

export function modelNameForCandidateResponse(
  candidateResponseId: number,
  responses: CandidateResponse[],
  modelSnapshots: RunModelSnapshot[],
): string {
  const response = responses.find((r) => r.id === candidateResponseId);
  if (!response) return `Response #${candidateResponseId}`;
  const model = modelSnapshots.find((m) => m.id === response.model_snapshot_id);
  return model?.display_name ?? `Model #${response.model_snapshot_id}`;
}

export function promptAggregateStatus(batches: JudgeBatch[]): string {
  if (batches.length === 0) return "pending";
  if (batches.every(isJudgeBatchCompleted)) return "completed";
  if (batches.some((b) => !isJudgeBatchCompleted(b) && b.status === "failed")) return "failed";
  if (batches.some((b) => !isJudgeBatchCompleted(b) && b.status === "running")) return "running";
  return "pending";
}

export function judgeBatchDisplayStatus(batch: JudgeBatch): string {
  return isJudgeBatchCompleted(batch) ? "completed" : batch.status;
}

export function isJudgeBatchCompleted(batch: JudgeBatch): boolean {
  return batch.status === "completed" || batch.evaluation !== null;
}

export function avgBatchScore(batches: JudgeBatch[]): number | null {
  const scores = batches
    .map((b) => b.evaluation?.candidates.map((c) => Number(c.overall_score)) ?? [])
    .flat()
    .filter(Number.isFinite);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function formatInspectorContent(
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

export function formatInspectorDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR").format(value);
}

export function formatTokensPerSecond(value: string | null | undefined): string {
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

export function formatDateTime(value: string | null | undefined): string | null {
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
