import { cn } from "@/lib/utils";
import { scoreToneClasses, formatScore } from "../utils";

export function ScoreStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-lg border px-1.5 py-1.5 text-center transition-all duration-200",
        scoreToneClasses(value, "soft"),
        highlight && "ring-1 ring-inset ring-slate-300",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 truncate leading-tight">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-none">{formatScore(value)}</p>
    </div>
  );
}
