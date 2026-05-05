import { Gavel, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { RunJudging, RunPromptSnapshot } from "../types";
import { promptAggregateStatus } from "../utils";
import { DifficultyDot } from "./difficulty-dot";
import { StatusPill } from "./status-pill";

export function JudgeBatchPanel({
  isClearing,
  isLoading,
  isRestarting,
  isStarting,
  isRetrying,
  onClear,
  onRestart,
  canStart,
  judging,
  onStart,
  onRetry,
  promptSnapshots,
  selectedPromptId,
  onSelectPrompt,
}: {
  isClearing: boolean;
  isLoading: boolean;
  isRestarting: boolean;
  isStarting: boolean;
  isRetrying: boolean;
  onClear: () => void;
  onRestart: () => void;
  canStart: boolean;
  judging: RunJudging | undefined;
  onStart: () => void;
  onRetry: () => void;
  promptSnapshots: RunPromptSnapshot[];
  selectedPromptId: number | null;
  onSelectPrompt: (promptId: number) => void;
}) {
  const isJudgingActive = isStarting || isRetrying || isClearing || isRestarting;

  const promptsWithBatches = promptSnapshots
    .map((prompt) => ({
      prompt,
      batches: judging?.items.filter((b) => b.prompt_snapshot_id === prompt.id) ?? [],
    }))
    .filter((g) => g.batches.length > 0);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading judge jobs...</p>;
  }

  if (!judging || judging.items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Button
          className="h-11 w-full gap-2 text-sm font-semibold"
          disabled={!canStart || isStarting}
          onClick={onStart}
          variant="secondary"
        >
          {isStarting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Judging in progress…
            </>
          ) : (
            <>
              <Gavel className="h-4 w-4" />
              Launch judging
            </>
          )}
        </Button>
        <div className="space-y-3">
          <div className="flex gap-3 rounded-[1rem] border border-sky-200/70 bg-sky-50/40 px-4 py-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-[11px] font-bold">
              1
            </div>
            <div>
              <p className="text-[0.82rem] font-semibold text-slate-900">Absolute review</p>
              <p className="mt-0.5 text-[0.79rem] leading-5 text-slate-500">
                Chaque modèle candidat est évalué indépendamment sur chaque prompt — score absolu de 0 à 100 sur 6 critères.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-[1rem] border border-violet-200/70 bg-violet-50/40 px-4 py-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">
              2
            </div>
            <div>
              <p className="text-[0.82rem] font-semibold text-slate-900">Arena pairwise</p>
              <p className="mt-0.5 text-[0.79rem] leading-5 text-slate-500">
                Les meilleurs modèles s'affrontent 2 par 2 par prompt — jusqu'à 3 matchs si les scores sont serrés (écart ≤ 3 pts).
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isJudgingActive ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-amber-600" />
          <p className="text-sm font-medium text-amber-900">
            {isClearing
              ? "Clearing phase 2…"
              : isRestarting
                ? "Restarting phase 2…"
                : isStarting || isRetrying
                  ? "Running judge jobs…"
                  : "Retrying job…"}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-8 gap-1.5 px-3 text-xs font-semibold" disabled={isJudgingActive} onClick={onRetry} variant="secondary">
          <LoaderCircle className="h-3.5 w-3.5" />
          Retry failed
        </Button>
        <Button className="h-8 gap-1.5 px-3 text-xs font-semibold" disabled={isJudgingActive} onClick={onRestart} variant="secondary">
          Restart
        </Button>
        <Button className="h-8 gap-1.5 px-3 text-xs font-semibold" disabled={isJudgingActive} onClick={onClear} variant="dangerSoft">
          Clear all
        </Button>
      </div>

      <div className="overflow-hidden rounded-[1rem] border border-border/70 bg-white shadow-sm">
        {promptsWithBatches.map(({ prompt, batches }, idx) => {
          const status = promptAggregateStatus(batches);
          const isSelected = selectedPromptId === prompt.id;
          return (
            <button
              key={prompt.id}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150",
                idx > 0 && "border-t border-border/50",
                isSelected
                  ? "bg-sky-50"
                  : "hover:bg-slate-50/80",
              )}
              onClick={() => onSelectPrompt(prompt.id)}
              type="button"
            >
              <DifficultyDot level={prompt.difficulty ?? null} />
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "truncate text-[0.82rem] font-medium",
                  isSelected ? "text-sky-800" : "text-slate-800",
                )}>
                  {prompt.name}
                </p>
              </div>
              <StatusPill status={status} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
