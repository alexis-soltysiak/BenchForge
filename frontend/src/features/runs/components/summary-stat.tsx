export function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-slate-50 px-3 py-2">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
