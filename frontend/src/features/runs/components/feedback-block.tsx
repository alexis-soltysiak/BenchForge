import type { LucideIcon } from "lucide-react";

export function FeedbackBlock({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-slate-50 p-2.5 transition-colors duration-200 hover:bg-white">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className="h-3 w-3 text-slate-400" /> : null}
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-700">{value}</p>
    </div>
  );
}
