import { cn } from "@/lib/utils";

export function StatusPill({ label, status, title }: { label?: string; status: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize",
        status === "completed" && "bg-emerald-100 text-emerald-900",
        ["running", "running_candidates", "waiting_local", "ready_for_judging", "judging", "aggregating", "reporting"].includes(status) &&
          "bg-amber-100 text-amber-900",
        ["failed", "cancelled"].includes(status) && "bg-rose-100 text-rose-900",
        ["pending", "pending_local"].includes(status) && "bg-slate-100 text-slate-700",
      )}
    >
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}
