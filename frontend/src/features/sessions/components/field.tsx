import type { ReactNode } from "react";

export function Field({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {hint ? (
        <span className="block text-xs leading-5 text-muted-foreground">{hint}</span>
      ) : null}
      <span className="block">
        {children}
      </span>
    </label>
  );
}
