import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl border border-border bg-[hsl(var(--surface))] px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-[hsl(var(--foreground-soft))] focus:border-[hsl(var(--primary)/0.5)] focus:bg-[hsl(var(--surface-elevated))]",
        className,
      )}
      {...props}
    />
  );
}
