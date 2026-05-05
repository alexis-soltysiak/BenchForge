import { cn } from "@/lib/utils";

export function InfoTag({
  tone,
  value,
}: {
  tone: "slate" | "sky" | "amber" | "emerald" | "rose";
  value: string;
}) {
  const toneClasses = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      <span className="normal-case tracking-normal">{value}</span>
    </span>
  );
}
