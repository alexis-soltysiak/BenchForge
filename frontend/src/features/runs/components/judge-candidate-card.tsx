import type { CandidateResponse, JudgeEvaluationCandidate, Run } from "../types";
import { modelById } from "../utils";
import { CandidateFeedbackAccordion } from "./candidate-feedback-accordion";

export function JudgeCandidateCard({
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
