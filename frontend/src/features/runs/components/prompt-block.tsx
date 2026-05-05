export function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-[1.1rem] border border-slate-200/90 bg-white/90 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <pre className="mt-2 max-h-[18rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950/[0.03] px-3 py-3 text-[12px] leading-5 text-slate-800">
        {text}
      </pre>
    </div>
  );
}
