import { Clock3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Run } from "../types";
import { formatCost, formatDuration, formatScore, modelById } from "../utils";
import { EmptyStatePanel } from "./empty-state-panel";
import { ScoreBadge } from "./score-badge";
import { SummaryInsightCard } from "./summary-insight-card";

export function AggregatedSummaryTable({ run }: { run: Run }) {
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
              <th className="px-4 py-3 font-semibold">Avg Absolute</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
              <th className="px-4 py-3 font-semibold">Tokens</th>
              <th className="px-4 py-3 font-semibold">Cost</th>
              <th className="px-4 py-3 font-semibold">Global</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {[...run.global_summaries]
              .sort((a, b) => parseFloat(b.final_global_score ?? b.average_overall_score) - parseFloat(a.final_global_score ?? a.average_overall_score))
              .map((summary) => {
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
              className="overflow-hidden rounded-[1.2rem] border border-border/60 bg-[hsl(var(--surface-overlay))] shadow-[0_18px_42px_-32px_rgba(15,23,42,0.14)]"
            >
              <div className="border-b border-border/40 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.95rem] font-semibold text-foreground">
                      {model?.display_name ?? "Unknown model"}
                    </p>
                    <p className="mt-1 text-[0.76rem] text-muted-foreground">
                      {model
                        ? `${model.provider_type} / ${model.runtime_type}`
                        : "Missing snapshot"}
                    </p>
                  </div>
                  <ScoreBadge value={summary.final_global_score} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="accent" className="whitespace-nowrap text-[0.68rem]">
                    avg {formatScore(summary.average_overall_score)}
                  </Badge>
                  <Badge variant="accent" className="whitespace-nowrap text-[0.68rem]">
                    {formatDuration(summary.avg_duration_ms)}
                  </Badge>
                  <Badge variant="accent" className="whitespace-nowrap text-[0.68rem]">
                    {formatCost(summary.total_estimated_cost)}
                  </Badge>
                </div>
                <p className="mt-3 text-[0.8rem] leading-6 text-muted-foreground">
                  {summary.global_summary_text ?? "No global summary generated."}
                </p>
              </div>

              <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
                <SummaryInsightCard
                  icon={Sparkles}
                  label="Best patterns"
                  tone="good"
                  value={summary.best_patterns_text ?? "No repeated strengths captured."}
                />
                <SummaryInsightCard
                  icon={Clock3}
                  label="Weak patterns"
                  tone="warn"
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
