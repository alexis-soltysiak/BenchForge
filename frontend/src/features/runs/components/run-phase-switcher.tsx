import { Gavel, Sparkles, SquareTerminal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunPhaseKey } from "../types";

export function RunPhaseSwitcher({
  activePhase,
  onPhaseChange,
  phase1Progress,
  phase2Progress,
  phase3Progress,
  phase2Unlocked,
  phase3Unlocked,
}: {
  activePhase: RunPhaseKey;
  onPhaseChange: (phase: RunPhaseKey) => void;
  phase1Progress: number;
  phase2Progress: number;
  phase3Progress: number;
  phase2Unlocked: boolean;
  phase3Unlocked: boolean;
}) {
  const phases = [
    {
      key: "phase1" as const,
      label: "Phase 1",
      subtitle: "Candidates",
      icon: SquareTerminal,
      progress: phase1Progress,
      unlocked: true,
      iconClass: "bg-primary/10 text-primary",
    },
    {
      key: "phase2" as const,
      label: "Phase 2",
      subtitle: "Judging",
      icon: Gavel,
      progress: phase2Progress,
      unlocked: phase2Unlocked,
      iconClass: "bg-primary/10 text-primary",
    },
    {
      key: "phase3" as const,
      label: "Phase 3",
      subtitle: "Report",
      icon: Sparkles,
      progress: phase3Progress,
      unlocked: phase3Unlocked,
      iconClass: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {phases.map((phase) => {
        const Icon = phase.icon;
        const isActive = phase.key === activePhase;
        const progressWidth = `${Math.max(0, Math.min(phase.progress, 1)) * 100}%`;

        return (
          <button
            key={phase.key}
            className={cn(
              "group relative overflow-hidden rounded-[1.25rem] border text-left transition duration-200",
              isActive
                ? "border-primary/30 bg-primary/5 shadow-sm"
                : phase.unlocked
                  ? "border-border/80 bg-[hsl(var(--surface))] hover:border-primary/20 hover:bg-primary/3"
                  : "cursor-not-allowed border-border/50 bg-[hsl(var(--surface-muted))] opacity-60",
            )}
            disabled={!phase.unlocked}
            onClick={() => phase.unlocked && onPhaseChange(phase.key)}
            type="button"
          >
            <div
              className="absolute bottom-0 left-0 h-0.5 bg-primary/40 transition-all duration-700"
              style={{ width: progressWidth }}
            />
            <div className="flex items-start justify-between gap-2 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    phase.iconClass,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p
                    className={cn(
                      "text-[0.95rem] font-semibold leading-none text-foreground",
                    )}
                  >
                    {phase.label}
                  </p>
                  <p className="mt-1 text-[0.8rem] leading-none text-muted-foreground">{phase.subtitle}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-[hsl(var(--surface-muted))] text-muted-foreground",
                  )}
                >
                  {!phase.unlocked ? "Locked" : isActive ? "Current" : "Open"}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
