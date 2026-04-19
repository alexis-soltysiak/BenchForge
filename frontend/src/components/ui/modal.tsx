import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sizeClasses = {
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  xxl: "max-w-[88rem]",
} as const;

const toneGlows = {
  amber: "bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_52%)]",
  emerald:
    "bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_52%)]",
  sky: "bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_52%)]",
} as const;

const toneEyebrows = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
} as const;

export function Modal({
  children,
  description,
  onClose,
  open,
  size = "lg",
  tone = "amber",
  title,
}: {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  size?: keyof typeof sizeClasses;
  tone?: keyof typeof toneGlows;
  title: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close modal"
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div
        aria-modal="true"
        className={cn(
          "relative flex max-h-[95vh] w-full flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] shadow-[0_48px_120px_-40px_rgba(15,23,42,0.65)]",
          sizeClasses[size],
        )}
        role="dialog"
      >
        <div className="relative shrink-0 border-b border-slate-200/80 px-6 py-5 sm:px-7">
          <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-32", toneGlows[tone])} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                  toneEyebrows[tone],
                )}
              >
                Workspace Editor
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-950">
                {title}
              </h2>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
            <Button
              aria-label="Close modal"
              onClick={onClose}
              size="icon"
              type="button"
              variant="soft"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
