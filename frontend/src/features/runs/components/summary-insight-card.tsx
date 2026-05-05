import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SummaryInsightCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: "good" | "warn";
  value: string;
}) {
  return (
    <div className="rounded-[1rem] border border-border/50 bg-[hsl(var(--surface))] p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg",
            tone === "good" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-3 text-[0.82rem] leading-6 text-foreground">
        {value}
      </p>
    </div>
  );
}
