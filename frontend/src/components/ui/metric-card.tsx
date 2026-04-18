import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MetricTone = "slate" | "sky" | "amber" | "emerald" | "teal";

const metricToneStyles: Record<
  MetricTone,
  {
    dot: string;
    iconShell: string;
    iconColor: string;
    valueAccent: string;
  }
> = {
  slate: {
    dot: "bg-slate-500",
    iconShell: "border-slate-200/80 bg-slate-50/95",
    iconColor: "text-slate-700",
    valueAccent: "bg-slate-200",
  },
  sky: {
    dot: "bg-sky-500",
    iconShell: "border-sky-200/80 bg-sky-50/95",
    iconColor: "text-sky-700",
    valueAccent: "bg-sky-200",
  },
  amber: {
    dot: "bg-amber-500",
    iconShell: "border-amber-200/80 bg-amber-50/95",
    iconColor: "text-amber-700",
    valueAccent: "bg-amber-200",
  },
  emerald: {
    dot: "bg-emerald-500",
    iconShell: "border-emerald-200/80 bg-emerald-50/95",
    iconColor: "text-emerald-700",
    valueAccent: "bg-emerald-200",
  },
  teal: {
    dot: "bg-teal-500",
    iconShell: "border-teal-200/80 bg-teal-50/95",
    iconColor: "text-teal-700",
    valueAccent: "bg-teal-200",
  },
};

export function MetricCard({
  compact = false,
  className,
  icon: Icon,
  label,
  tone = "slate",
  value,
}: {
  className?: string;
  compact?: boolean;
  icon: LucideIcon;
  label: string;
  tone?: MetricTone;
  value: string;
}) {
  const toneStyles = metricToneStyles[tone];

  return (
    <div
      className={cn(
        "rounded-[1.6rem] border border-white/80 bg-white/92 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28)] backdrop-blur",
        compact ? "px-3.5 py-3.5" : "px-4.5 py-4.5",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex h-full flex-col justify-between",
          compact ? "min-h-[5.4rem]" : "min-h-[6.9rem]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  toneStyles.dot,
                )}
              />
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500",
                  compact ? "max-w-[6rem] leading-5" : "max-w-[8.5rem] leading-5",
                )}
              >
                {label}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-[1rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_20px_-18px_rgba(15,23,42,0.2)]",
              toneStyles.iconShell,
              compact ? "h-11 w-11" : "h-12 w-12",
            )}
          >
            <Icon
              className={cn(
                compact ? "h-[1.05rem] w-[1.05rem]" : "h-[1.15rem] w-[1.15rem]",
                toneStyles.iconColor,
              )}
            />
          </span>
        </div>

        <div className={compact ? "mt-3" : "mt-5"}>
          <p
            className={cn(
              "font-semibold leading-none tracking-tight text-slate-950",
              compact ? "text-[2.15rem]" : "text-[2.85rem]",
            )}
          >
            {value}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div
              className={cn(
                "h-[3px] rounded-full",
                compact ? "w-9" : "w-12",
                toneStyles.valueAccent,
              )}
            />
            <div className="h-px flex-1 bg-slate-200/80" />
          </div>
        </div>
      </div>
    </div>
  );
}
