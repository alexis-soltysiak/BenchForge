import type { HTMLAttributes } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
        accent:
          "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]",
        success:
          "bg-[hsl(var(--theme-success-soft))] text-[hsl(var(--theme-success-foreground))]",
        muted: "bg-[hsl(var(--surface-muted))] text-[hsl(var(--foreground-soft))]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ className, variant }))} {...props} />;
}
