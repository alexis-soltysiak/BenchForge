export function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-emerald-200/80 bg-white/85 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-medium text-slate-900">{value}</p>
    </div>
  );
}
