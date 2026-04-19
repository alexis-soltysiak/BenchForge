import type { ButtonHTMLAttributes } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary)/0.24)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_14px_32px_-18px_rgba(15,23,42,0.3)] hover:brightness-[1.06]",
        secondary:
          "border border-border bg-[hsl(var(--surface))] text-foreground shadow-sm hover:bg-[hsl(var(--surface-muted))]",
        soft:
          "border border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))] hover:brightness-[0.98]",
        ghost:
          "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-foreground",
        danger: "bg-rose-600 text-white hover:bg-rose-700",
        dangerSoft:
          "border border-[hsl(var(--theme-danger-border))] bg-[hsl(var(--theme-danger-soft))] text-[hsl(var(--theme-danger-foreground))] hover:brightness-[0.98]",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-4",
        lg: "h-12 px-5",
        iconSm: "h-9 w-9",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}
