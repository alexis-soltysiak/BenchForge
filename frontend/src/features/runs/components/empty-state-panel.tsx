import { cn } from "@/lib/utils";

export function EmptyStatePanel({
  description,
  title,
  tone = "default",
}: {
  description: string;
  title: string;
  tone?: "default" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.4rem] border p-4",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-border/80 bg-slate-50",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          tone === "success" ? "text-emerald-950" : "text-slate-950",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mt-2 text-sm",
          tone === "success" ? "text-emerald-900" : "text-slate-600",
        )}
      >
        {description}
      </p>
    </div>
  );
}
