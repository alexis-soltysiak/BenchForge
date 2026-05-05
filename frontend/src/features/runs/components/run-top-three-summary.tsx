import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Run, RunGlobalSummary } from "../types";
import { formatRunListScore, formatRunListLatency, formatRunListCost } from "../utils";

export function RunTopThreeSummary({
  run,
  summaries,
}: {
  run: Run;
  summaries: RunGlobalSummary[];
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      {summaries.map((summary, index) => {
        const model = run.model_snapshots.find((item) => item.id === summary.model_snapshot_id);
        const rank = index + 1;
        return (
          <div
            key={summary.id}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2 py-1",
              rank === 1
                ? "border-primary/20 bg-primary/6"
                : "border-border/50 bg-[hsl(var(--surface))]",
            )}
          >
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.58rem] font-bold",
                rank === 1 && "bg-amber-100 text-amber-700",
                rank === 2 && "bg-slate-100 text-slate-600",
                rank === 3 && "bg-orange-100 text-orange-700",
              )}
            >
              {rank === 1 ? <Award className="h-2.5 w-2.5" /> : rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[0.74rem] font-medium text-foreground">
                  {model?.display_name ?? `Modèle ${rank}`}
                </p>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.64rem] text-muted-foreground">
                <span>
                  score <span className="font-semibold text-foreground">{formatRunListScore(summary.final_global_score)}</span>
                </span>
                {rank === 1 ? (
                  <>
                    <span className="text-border/60">·</span>
                    <span>{formatRunListLatency(summary.avg_duration_ms)}</span>
                    <span className="text-border/60">·</span>
                    <span>{formatRunListCost(summary.total_estimated_cost)}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
