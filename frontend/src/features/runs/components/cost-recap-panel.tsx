import type { CandidateResponse, Run, RunJudging } from "../types";

export function CostRecapPanel({ run, judging, responses }: { run: Run; judging: RunJudging | undefined; responses: CandidateResponse[] }) {
  const candidateModels = run.model_snapshots.filter((m) => m.role === "candidate");
  const judgeModels = run.model_snapshots.filter((m) => m.role === "judge");

  const phase1Rows = candidateModels.map((model) => {
    const modelResponses = responses.filter((r) => r.model_snapshot_id === model.id);
    const hasCost = modelResponses.some((r) => r.metric?.estimated_cost != null);
    const total = modelResponses.reduce((acc, r) => acc + (r.metric?.estimated_cost ? Number(r.metric.estimated_cost) : 0), 0);
    return { model, cost: hasCost ? total : null };
  });
  const phase1Total = phase1Rows.reduce((acc, row) => acc + (row.cost ?? 0), 0);
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

      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3">
        <span className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Total session cost</span>
        <span className="text-2xl font-extrabold text-emerald-700 font-mono">
          {hasAnyCost ? `$${grandTotal.toFixed(4)}` : "—"}
        </span>
      </div>
    </div>
  );
}
