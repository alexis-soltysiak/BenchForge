import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const sizeClasses = {
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  xxl: "max-w-[88rem]",
} as const;

export function Modal({
  children,
  description,
  headerAction,
  onClose,
  open,
  size = "lg",
  title,
}: {
  children: ReactNode;
  description?: string;
  headerAction?: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: keyof typeof sizeClasses;
  title: string;
  /** @deprecated use description prop */
  tone?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <button
        aria-label="Close modal"
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />

      {/* Panel */}
      <div
        aria-modal="true"
        role="dialog"
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden",
          "rounded-2xl border border-border/60",
          "bg-[hsl(var(--surface-elevated))]",
          "shadow-[0_48px_120px_-32px_rgba(0,0,0,0.7)]",
          sizeClasses[size],
        )}
      >
        {/* Glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--primary)/0.1),_transparent_60%)]" />

        {/* Header */}
        <div className="relative shrink-0 border-b border-border/50 px-6 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
              <button
                aria-label="Close modal"
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-[hsl(var(--surface-muted))] text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
