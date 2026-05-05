import { useState } from "react";
import { ChevronDown, Eye, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CandidateResponse, JudgeBatch, Run, RunJudging, RunModelSnapshot, RunPromptSnapshot } from "../types";
import {
  avgBatchScore,
  judgeBatchDisplayStatus,
  modelNameForCandidateResponse,
  parseBatchCandidateIds,
  promptAggregateStatus,
  scoreToneClasses,
} from "../utils";
import { CodeBlock } from "./code-block";
import { JudgeFeedbackPanel } from "./judge-feedback-panel";
import { StatusPill } from "./status-pill";

export function PromptJudgeResultsPanel({
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

  const promptBatches = judging.items.filter((b) => b.prompt_snapshot_id === promptId);
  const absoluteBatches = promptBatches.filter((b) => b.batch_type === "absolute");
  const arenaBatches = promptBatches.filter((b) => b.batch_type === "arena");

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

  const sortedModelGroups = [...modelGroupsMap.entries()].sort(([, a], [, b]) => {
    const scoreA = avgBatchScore(a.batches);
    const scoreB = avgBatchScore(b.batches);
    if (scoreA === null && scoreB === null) return 0;
    if (scoreA === null) return 1;
    if (scoreB === null) return -1;
    return scoreB - scoreA;
  });

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
