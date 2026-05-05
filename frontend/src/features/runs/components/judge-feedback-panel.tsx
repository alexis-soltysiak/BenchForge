import type { CandidateResponse, JudgeBatch, Run } from "../types";
import { EmptyStatePanel } from "./empty-state-panel";
import { JudgeCandidateCard } from "./judge-candidate-card";

export function JudgeFeedbackPanel({
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
