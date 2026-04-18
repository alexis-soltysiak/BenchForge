import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-400",
        className,
      )}
      {...props}
    />
  );
}

