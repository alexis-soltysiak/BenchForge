import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, FileCode, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import type { CandidateResponse, PassAtKSummary, Run } from "../types";

export function PassAtKSummaryTable({ run, responses }: { run: Run; responses: CandidateResponse[] }) {
  const [expandedModelId, setExpandedModelId] = useState<number | null>(null);
  const [codeViewResponse, setCodeViewResponse] = useState<CandidateResponse | null>(null);

  const expandedResponsesMap = useMemo(() => {
    if (expandedModelId === null) return new Map<number, Map<number, CandidateResponse>>();
    const map = new Map<number, Map<number, CandidateResponse>>();
    for (const r of responses) {
      if (r.model_snapshot_id !== expandedModelId) continue;
      if (!map.has(r.prompt_snapshot_id)) map.set(r.prompt_snapshot_id, new Map());
      map.get(r.prompt_snapshot_id)!.set(r.sample_index, r);
    }
    return map;
  }, [expandedModelId, responses]);

  if (run.pass_at_k_summaries.length === 0) return null;

  const sortedSummaries = [...run.pass_at_k_summaries].sort(
    (a, b) => b.pass_5_rate - a.pass_5_rate,
  );

  const difficultyLevels = [
    ...new Set(
      sortedSummaries.flatMap((s) => s.difficulty_breakdown.map((d) => d.difficulty)),
    ),
  ].sort((a, b) => a - b);

  const codeGenPrompts = run.prompt_snapshots.filter(
    (ps) => ps.scenario_type === "code_generation",
  );

  const allIterative = codeGenPrompts.length > 0 && codeGenPrompts.every((ps) => ps.sampling_mode === "iterative");
  const anyIterative = codeGenPrompts.some((ps) => ps.sampling_mode === "iterative");
  const sectionLabel = allIterative
    ? "Code Generation — Iterative refinement"
    : anyIterative
      ? "Code Generation — Mixed (pass@k + iterative)"
      : "Code Generation — pass@k";

  const codeViewPrompt = codeViewResponse
    ? run.prompt_snapshots.find((ps) => ps.id === codeViewResponse.prompt_snapshot_id)
    : null;
  const codeViewModel = codeViewResponse
    ? run.model_snapshots.find((m) => m.id === codeViewResponse.model_snapshot_id)
    : null;

  return (
    <>
      <div className="space-y-5">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {sectionLabel}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/80 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">{allIterative ? "solved@1" : "pass@1"}</th>
                  <th className="px-4 py-3 font-semibold">{allIterative ? "solved@3" : "pass@3"}</th>
                  <th className="px-4 py-3 font-semibold">{allIterative ? "solved@5" : "pass@5"}</th>
                  <th className="px-4 py-3 font-semibold">{allIterative ? "Improvement@5" : "Iteration Potential"}</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {sortedSummaries.map((summary: PassAtKSummary) => {
                  const model = run.model_snapshots.find(
                    (m) => m.id === summary.model_snapshot_id,
                  );
                  const iterationPotential = summary.pass_5_rate - summary.pass_1_rate;
                  const isExpanded = expandedModelId === summary.model_snapshot_id;
                  return (
                    <Fragment key={summary.model_snapshot_id}>
                      <tr>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-950">
                            {model?.display_name ?? `Model #${summary.model_snapshot_id}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {summary.code_gen_prompt_count} prompt{summary.code_gen_prompt_count !== 1 ? "s" : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {`${(summary.pass_1_rate * 100).toFixed(1)}%`}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {`${(summary.pass_3_rate * 100).toFixed(1)}%`}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {`${(summary.pass_5_rate * 100).toFixed(1)}%`}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {`${(iterationPotential * 100).toFixed(1)}%`}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedModelId(isExpanded ? null : summary.model_snapshot_id)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-border hover:text-slate-900"
                          >
                            <FileCode className="h-3.5 w-3.5" />
                            Browse
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 transition-transform",
                                isExpanded && "rotate-180",
                              )}
                            />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/80 px-6 py-4">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-slate-500">
                                  <th className="pb-2 pr-4 font-semibold">Prompt</th>
                                  <th className="pb-2 pr-4 font-semibold">Diff</th>
                                  <th className="pb-2 pr-4 font-semibold">Mode</th>
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <th key={n} className="pb-2 pr-3 font-semibold">#{n}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40">
                                {codeGenPrompts.map((ps) => {
                                  const isIterative = ps.sampling_mode === "iterative";
                                  const samplesMap =
                                    expandedResponsesMap.get(ps.id) ?? new Map<number, CandidateResponse>();
                                  return (
                                    <tr key={ps.id}>
                                      <td className="py-2 pr-4 text-slate-800">
                                        <span className="block max-w-[18rem] truncate" title={ps.name}>
                                          {ps.name}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4 text-slate-500">
                                        {ps.difficulty ?? "—"}
                                      </td>
                                      <td className="py-2 pr-4">
                                        <span className={cn(
                                          "inline-block rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide",
                                          isIterative
                                            ? "bg-violet-100 text-violet-700"
                                            : "bg-sky-100 text-sky-700",
                                        )}>
                                          {isIterative ? "iterative" : "pass@k"}
                                        </span>
                                      </td>
                                      {[0, 1, 2, 3, 4].map((i) => {
                                        const r = samplesMap.get(i);
                                        const isSkipped = r?.error_message?.startsWith("Skipped —");
                                        if (!r || isSkipped) {
                                          return (
                                            <td key={i} className="py-2 pr-3">
                                              <span className="text-slate-300">—</span>
                                            </td>
                                          );
                                        }
                                        const passed =
                                          r.execution_tier !== null && r.execution_tier > 0;
                                        const label = isIterative
                                          ? `View attempt ${i + 1} — Tier ${r.execution_tier ?? "?"}`
                                          : `View sample #${i} — Tier ${r.execution_tier ?? "?"}`;
                                        return (
                                          <td key={i} className="py-2 pr-3">
                                            <button
                                              type="button"
                                              title={label}
                                              onClick={() => setCodeViewResponse(r)}
                                              className={cn(
                                                "inline-flex h-6 w-6 items-center justify-center rounded-full transition hover:opacity-70",
                                                passed
                                                  ? "bg-emerald-100 text-emerald-700"
                                                  : "bg-rose-100 text-rose-600",
                                              )}
                                            >
                                              {passed ? (
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                              ) : (
                                                <XCircle className="h-3.5 w-3.5" />
                                              )}
                                            </button>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {difficultyLevels.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              pass@1 by Difficulty
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/80 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Difficulty</th>
                    {sortedSummaries.map((s) => {
                      const model = run.model_snapshots.find(
                        (m) => m.id === s.model_snapshot_id,
                      );
                      return (
                        <th key={s.model_snapshot_id} className="px-4 py-3 font-semibold">
                          {model?.display_name ?? `Model #${s.model_snapshot_id}`}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {difficultyLevels.map((diff) => (
                    <tr key={diff}>
                      <td className="px-4 py-3 font-medium text-slate-950">{diff}</td>
                      {sortedSummaries.map((s) => {
                        const entry = s.difficulty_breakdown.find(
                          (d) => d.difficulty === diff,
                        );
                        return (
                          <td key={s.model_snapshot_id} className="px-4 py-3 text-slate-700">
                            {entry
                              ? `${(entry.pass_1_rate * 100).toFixed(1)}% (${entry.prompt_count})`
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={codeViewResponse !== null}
        onClose={() => setCodeViewResponse(null)}
        title={(() => {
          const n = (codeViewResponse?.sample_index ?? 0) + 1;
          const label = codeViewPrompt?.sampling_mode === "iterative" ? `Attempt #${n}` : `Sample #${n - 1}`;
          return `${codeViewPrompt?.name ?? "Code"} · ${label}`;
        })()}
        description={`${codeViewModel?.display_name ?? "Unknown model"} · ${
          codeViewResponse?.execution_tier != null && codeViewResponse.execution_tier > 0
            ? `Tier ${codeViewResponse.execution_tier} — passed`
            : "Tier 0 — failed"
        }`}
        size="xl"
      >
        <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          <code>{codeViewResponse?.normalized_response_text ?? "(no output)"}</code>
        </pre>
      </Modal>
    </>
  );
}
