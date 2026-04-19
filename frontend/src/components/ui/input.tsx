import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-[hsl(var(--surface))] px-3 text-sm text-foreground outline-none transition placeholder:text-[hsl(var(--foreground-soft))] focus:border-[hsl(var(--primary)/0.5)] focus:bg-[hsl(var(--surface-elevated))]",
        className,
      )}
      {...props}
    />
  );
}
