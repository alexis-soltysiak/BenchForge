import type { ReactNode } from "react";

export function ModalField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </span>
      {children}
    </div>
  );
}
