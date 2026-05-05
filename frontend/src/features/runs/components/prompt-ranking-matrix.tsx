import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CandidateResponse, Run, RunJudging } from "../types";
import { formatScore, isJudgeBatchCompleted, promptById } from "../utils";
import { EmptyStatePanel } from "./empty-state-panel";
import { SectionHeading } from "./section-heading";

export function PromptRankingMatrix({
  judging,
  responses,
  run,
}: {
  judging: RunJudging | undefined;
  responses: CandidateResponse[];
  run: Run;
}) {
  const completedBatches = useMemo(
    () =>
      judging?.items.filter(
        (batch) =>
          batch.batch_type === "absolute" &&
          isJudgeBatchCompleted(batch),
      ) ?? [],
    [judging?.items],
  );

  const columns = useMemo(() => {
    return run.prompt_snapshots
      .filter((prompt) => completedBatches.some((b) => b.prompt_snapshot_id === prompt.id))
      .map((prompt) => ({ promptId: prompt.id }));
  }, [completedBatches, run.prompt_snapshots]);

  const candidates = useMemo(
    () => run.model_snapshots.filter((item) => item.role === "candidate"),
    [run.model_snapshots],
  );
  const isCompactMatrix = columns.length >= 10;

  const promptRankings = useMemo(() => {
    const arenaBatches = judging?.items.filter(
      (b) => b.batch_type === "arena" && b.status === "completed" && b.evaluation,
    ) ?? [];

    return new Map(
      columns.map(({ promptId }) => {
        const promptAbsBatches = completedBatches.filter((b) => b.prompt_snapshot_id === promptId);
        const promptArenaBatches = arenaBatches.filter((b) => b.prompt_snapshot_id === promptId);

        const candidateScores = candidates.map((cand) => {
          const scores = promptAbsBatches.flatMap((b) => {
            const ec = b.evaluation?.candidates.find((c) => {
              const r = responses.find((r) => r.id === c.candidate_response_id);
              return r?.model_snapshot_id === cand.id;
            });
            return ec ? [Number(ec.overall_score) || 0] : [];
          });
          return { id: cand.id, score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0 };
        });

        const sortedByScore = [...candidateScores].sort((a, b) => b.score - a.score);
        const top3Ids = sortedByScore.slice(0, 3).map((x) => x.id);

        const arenaWinnerId = (() => {
          if (promptArenaBatches.length === 0) return top3Ids[0];
          const winRates = top3Ids.map((id) => {
            const appeared = promptArenaBatches.filter((b) =>
              b.evaluation?.candidates.some((c) => {
                const r = responses.find((r) => r.id === c.candidate_response_id);
                return r?.model_snapshot_id === id;
              }),
            );
            const wins = appeared.filter((b) => {
              const ec = b.evaluation?.candidates.find((c) => {
                const r = responses.find((r) => r.id === c.candidate_response_id);
                return r?.model_snapshot_id === id;
              });
              return ec?.ranking_in_batch === 1;
            });
            return { id, winRate: appeared.length > 0 ? wins.length / appeared.length : 0 };
          });
          return winRates.sort((a, b) => b.winRate - a.winRate)[0].id;
        })();

        const rankedIds = [arenaWinnerId, ...sortedByScore.filter((x) => x.id !== arenaWinnerId).map((x) => x.id)];
        const rankMap = new Map<number, number>();
        rankedIds.forEach((id, i) => rankMap.set(id, i + 1));
        return [promptId, rankMap] as const;
      }),
    );
  }, [columns, completedBatches, judging?.items, candidates, responses]);

  if (completedBatches.length === 0 || candidates.length === 0) {
    return (
      <EmptyStatePanel
        title="No scenario ranking yet"
        description="Scenario-by-scenario ranking becomes available after absolute judge jobs complete."
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Scenario Ranking Matrix"
      />
      <div className={cn(
        "overflow-hidden rounded-[1.25rem] border border-border/80 bg-white",
        isCompactMatrix ? "p-2" : "p-3",
      )}>
        <div className="max-w-full overflow-hidden">
          <table className="w-full table-fixed divide-y divide-border/80 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className={cn(
                  "bg-slate-50 px-2 py-2 font-semibold",
                  isCompactMatrix ? "w-[9rem]" : "w-[13rem]",
                )}>
                  Model
                </th>
                {columns.map(({ promptId }, index) => {
                  const prompt = promptById(run.prompt_snapshots, promptId);
                  return (
                    <th key={promptId} className={cn("py-2 font-semibold", isCompactMatrix ? "px-0.5" : "px-1.5")}>
                      <div className="space-y-0.5 text-center">
                        <p className={cn(
                          "truncate font-semibold uppercase text-slate-400",
                          isCompactMatrix ? "text-[9px]" : "text-[10px] tracking-[0.14em]",
                        )}>
                          P{index + 1}
                        </p>
                        <p className={cn("truncate text-slate-700", isCompactMatrix ? "text-[10px]" : "text-[11px]")}>
                          {prompt?.name ?? `Scenario #${promptId}`}
                        </p>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td className={cn(
                    "bg-white px-2 py-1.5 align-middle",
                    isCompactMatrix ? "w-[9rem]" : "w-[13rem]",
                  )}>
                    <div className="space-y-0.5">
                      <p className={cn("truncate font-medium text-slate-950", isCompactMatrix ? "text-[11px]" : "text-xs")}>
                        {candidate.display_name}
                      </p>
                      <p className={cn("truncate text-slate-500", isCompactMatrix ? "text-[9px]" : "text-[10px]")}>
                        {candidate.provider_type} / {candidate.runtime_type}
                      </p>
                    </div>
                  </td>
                  {columns.map(({ promptId }) => {
                    const promptBatches = completedBatches.filter(
                      (b) => b.prompt_snapshot_id === promptId,
                    );
                    const evalEntries = promptBatches.flatMap((b) => {
                      const ec = b.evaluation?.candidates.find((c) => {
                        const r = responses.find((r) => r.id === c.candidate_response_id);
                        return r?.model_snapshot_id === candidate.id;
                      });
                      return ec ? [ec] : [];
                    });

                    if (evalEntries.length === 0) {
                      return (
                        <td key={`${candidate.id}-${promptId}`} className={cn("py-2", isCompactMatrix ? "px-0.5" : "px-1.5")}>
                          <div className={cn(
                            "rounded-lg border border-dashed border-border/70 bg-slate-50 text-center text-slate-400",
                            isCompactMatrix ? "px-1 py-1.5 text-[9px]" : "px-2 py-2 text-[10px]",
                          )}>
                            —
                          </div>
                        </td>
                      );
                    }

                    const scores = evalEntries.map((ec) => Number(ec.overall_score) || 0);
                    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                    const rank = promptRankings.get(promptId)?.get(candidate.id) ?? candidates.length;
                    const isFirst = rank === 1;
                    const isSecond = rank === 2;
                    const isThird = rank === 3;
                    const displayScore = Math.round(avgScore);

                    return (
                      <td key={`${candidate.id}-${promptId}`} className={cn("align-middle", isCompactMatrix ? "px-0.5 py-1" : "px-1.5 py-1.5")}>
                        <div
                          className={cn(
                            "flex items-center justify-between rounded-xl border",
                            isCompactMatrix ? "h-[3.25rem] gap-0.5 px-1" : "h-[4.1rem] gap-1 px-2",
                            isFirst
                              ? "border-blue-400 bg-gradient-to-b from-blue-500 to-blue-600 shadow-[0_10px_28px_-8px_rgba(59,130,246,0.65)]"
                              : isSecond
                              ? "border-violet-200 bg-gradient-to-b from-violet-50 to-violet-100/60"
                              : isThird
                              ? "border-teal-200 bg-gradient-to-b from-teal-50/80 to-cyan-50/60"
                              : "border-border/60 bg-slate-50",
                          )}
                        >
                          <span
                            className={cn(
                              "shrink-0 rounded-full font-bold",
                              isCompactMatrix ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[11px]",
                              isFirst
                                ? "bg-blue-400/50 text-white"
                                : isSecond
                                ? "bg-violet-100 text-violet-700"
                                : isThird
                                ? "bg-teal-100 text-teal-700"
                                : "bg-slate-100 text-slate-400",
                            )}
                          >
                            #{rank}
                          </span>
                          <p
                            className={cn(
                              "min-w-0 flex-1 text-right font-bold leading-none tracking-tight",
                              isFirst
                                ? isCompactMatrix ? "text-[1.35rem] text-white" : "text-[1.9rem] text-white"
                                : isSecond
                                ? isCompactMatrix ? "text-[1.25rem] text-violet-900" : "text-[1.65rem] text-violet-900"
                                : isThird
                                ? isCompactMatrix ? "text-[1.25rem] text-teal-800" : "text-[1.65rem] text-teal-800"
                                : isCompactMatrix ? "text-[1.25rem] text-slate-300" : "text-[1.65rem] text-slate-300",
                            )}
                          >
                            {formatScore(String(displayScore))}
                          </p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
