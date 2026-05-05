import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CandidateResponse, LocalExecutionNextResponse, RunModelSnapshot } from "../types";
import { MetaPill } from "./meta-pill";
import { StatusPill } from "./status-pill";

export function CandidateExecutionCard({
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
