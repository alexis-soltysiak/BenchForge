import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-400",
        className,
      )}
      {...props}
    />
  );
}

