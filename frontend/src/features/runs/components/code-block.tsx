import { cn } from "@/lib/utils";

export function CodeBlock({
  content,
  isJson = false,
  tone = "slate",
}: {
  content: string;
  isJson?: boolean;
  tone?: "amber" | "rose" | "slate";
}) {
  const toneClasses = {
    amber: "border-amber-200/80 bg-amber-950/[0.03] text-slate-900",
    rose: "border-rose-200/80 bg-rose-950/[0.03] text-rose-950",
    slate: "border-slate-200/90 bg-slate-950/[0.03] text-slate-900",
  } as const;

  return (
    <div className={cn("rounded-[1.1rem] border", toneClasses[tone])}>
      <div className="flex items-center justify-between border-b border-inherit px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {isJson ? "Pretty JSON" : "Text"}
        </p>
      </div>
      <pre className="max-h-[32rem] overflow-auto px-3 py-3 font-mono text-[12px] leading-5 whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  );
}
