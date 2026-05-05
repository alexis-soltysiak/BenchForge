import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InspectorPanel({
  accent = "slate",
  children,
  eyebrow,
  subtitle,
  title,
}: {
  accent?: "amber" | "emerald" | "rose" | "sky" | "slate";
  children: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
}) {
  const accentClasses = {
    amber: "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]",
    emerald:
      "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))]",
    rose: "border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.98))]",
    sky: "border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.96),rgba(255,255,255,0.98))]",
    slate:
      "border-border/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))]",
  } as const;

  const eyebrowClasses = {
    amber: "bg-amber-100 text-amber-900",
    emerald: "bg-emerald-100 text-emerald-900",
    rose: "bg-rose-100 text-rose-900",
    sky: "bg-sky-100 text-sky-900",
    slate: "bg-slate-100 text-slate-700",
  } as const;

  return (
    <section className={cn("rounded-[1.4rem] border p-4 shadow-sm", accentClasses[accent])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                eyebrowClasses[accent],
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h3 className="mt-2 text-base font-semibold tracking-tight text-slate-950">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-[12px] leading-5 text-slate-600">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
