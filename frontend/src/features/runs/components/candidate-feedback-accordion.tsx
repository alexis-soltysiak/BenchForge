import { useState } from "react";
import { ChevronDown, Clock3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JudgeEvaluationCandidate, RunModelSnapshot } from "../types";
import { ExecutionTierBadge } from "./execution-tier-badge";
import { ScoreStat } from "./score-stat";
import { FeedbackBlock } from "./feedback-block";

export function CandidateFeedbackAccordion({
  candidate,
  executionTier = null,
  model,
  onOpenResponse,
}: {
  candidate: JudgeEvaluationCandidate;
  executionTier?: number | null;
  model: RunModelSnapshot | undefined;
  onOpenResponse?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        "group rounded-xl border border-border/80 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-[0_20px_40px_-32px_rgba(15,23,42,0.22)]",
        isExpanded && "shadow-[0_20px_44px_-34px_rgba(15,23,42,0.26)]",
      )}
    >
      <div
        className={cn(
          "p-3 outline-none transition-colors duration-200",
          onOpenResponse &&
            "cursor-pointer active:scale-[0.997]",
        )}
        onClick={() => onOpenResponse?.()}
        onKeyDown={(event) => {
          if (!onOpenResponse) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenResponse();
          }
        }}
        role={onOpenResponse ? "button" : undefined}
        tabIndex={onOpenResponse ? 0 : undefined}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Candidate
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              {candidate.anonymized_candidate_label}
            </span>
          </div>
          <p className="min-w-0 truncate text-sm font-semibold text-slate-950 transition-colors duration-150 group-hover:text-slate-700">
            {model?.display_name ?? "Candidate model"}
          </p>
          <span className="truncate text-xs text-slate-400">
            {model ? `${model.provider_type} / ${model.runtime_type}` : ""}
          </span>
          <ExecutionTierBadge tier={executionTier} />
        </div>
        <div className="mt-2 grid grid-cols-[2rem_repeat(6,minmax(0,1fr))_4px_minmax(0,1fr)] items-stretch gap-1.5">
          <button
            className={cn(
              "flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-all duration-200 hover:border-slate-300 hover:bg-white active:scale-[0.97]",
              isExpanded && "bg-slate-100",
            )}
            onClick={(event) => {
              event.stopPropagation();
              setIsExpanded((current) => !current);
            }}
            type="button"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-all duration-200 group-hover:text-slate-500",
                isExpanded && "rotate-180 text-slate-600",
              )}
            />
          </button>
          <ScoreStat label="Relev." value={candidate.relevance_score} />
          <ScoreStat label="Accur." value={candidate.accuracy_score} />
          <ScoreStat label="Compl." value={candidate.completeness_score} />
          <ScoreStat label="Clarity" value={candidate.clarity_score} />
          <ScoreStat label="Instr." value={candidate.instruction_following_score} />
          <ScoreStat label="Confid." value={candidate.judge_confidence_score ?? "—"} />
          <div className="self-stretch rounded-full bg-border/70" />
          <ScoreStat label="Overall" value={candidate.overall_score} highlight />
        </div>
      </div>
      {isExpanded ? (
        <div className="border-t border-border/70 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <FeedbackBlock
              icon={Sparkles}
              label="Strengths"
              value={candidate.strengths_text ?? "No strengths summary provided."}
            />
            <FeedbackBlock
              icon={Clock3}
              label="Weaknesses"
              value={candidate.weaknesses_text ?? "No weaknesses summary provided."}
            />
          </div>
          <div className="mt-2 space-y-2">
            <FeedbackBlock
              label="Short feedback"
              value={candidate.short_feedback ?? "No short feedback provided."}
            />
            <FeedbackBlock
              label="Detailed feedback"
              value={candidate.detailed_feedback ?? "No detailed feedback provided."}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
