import type { ComponentProps, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeInfo } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActionIconButton({
  children,
  description,
  label,
  ...props
}: ComponentProps<typeof Button> & {
  children: ReactNode;
  description: string;
  label: string;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setPosition({
        left: rect.left + rect.width / 2,
        top: rect.top - 18,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  return (
    <div
      ref={triggerRef}
      className="relative"
      onBlur={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Button {...props}>{children}</Button>
      {isOpen
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[250] w-64 -translate-x-1/2 -translate-y-full"
              style={{ left: position.left, top: position.top }}
            >
              <div className="relative rounded-2xl border border-border bg-[hsl(var(--surface-overlay))] p-3 text-left shadow-[0_24px_60px_-22px_rgba(15,23,42,0.22)] ring-1 ring-[hsl(var(--border)/0.6)] backdrop-blur-sm">
                <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-border bg-[hsl(var(--surface-overlay))]" />
                <div className="relative overflow-hidden rounded-xl border border-border bg-[linear-gradient(135deg,_hsl(var(--surface-muted)),_hsl(var(--surface)))] p-3">
                  <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-emerald-400" />
                  <div className="flex items-start gap-3 pl-2">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--theme-success-soft))] text-[hsl(var(--theme-success-foreground))] shadow-sm">
                      <BadgeInfo className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="mt-1 text-xs leading-5 text-[hsl(var(--foreground-soft))]">
                        {description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
