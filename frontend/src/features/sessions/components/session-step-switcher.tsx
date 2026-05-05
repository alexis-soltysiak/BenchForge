import { useTranslation } from "react-i18next";
import { BadgeInfo, Layers3, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Session } from "../types";
import type { SessionSelectionStep } from "../types";

export function SessionStepSwitcher({
  activeStep,
  onStepChange,
  session,
}: {
  activeStep: SessionSelectionStep;
  onStepChange: (step: SessionSelectionStep) => void;
  session: Session | null;
}) {
  const { t } = useTranslation();

  const steps = [
    {
      key: "information" as const,
      count: null as number | null,
      icon: BadgeInfo,
      label: t("sessions.selection.information"),
      disabled: false,
      activeClassName:
        "border-slate-300 bg-slate-50 text-slate-900 shadow-sm",
      idleClassName:
        "border-border/80 bg-[hsl(var(--surface))] text-foreground hover:border-slate-300 hover:bg-slate-50/80",
      iconClassName: "bg-slate-100 text-slate-600",
      badgeVariant: "neutral" as const,
    },
    {
      key: "prompts" as const,
      count: session?.prompts.length ?? null,
      icon: Layers3,
      label: t("sessions.selection.prompts"),
      disabled: !session,
      activeClassName:
        "border-[hsl(var(--theme-success-border))] bg-[hsl(var(--theme-success-soft))] text-[hsl(var(--theme-success-foreground))] shadow-sm",
      idleClassName:
        "border-border/80 bg-[hsl(var(--surface))] text-foreground hover:border-[hsl(var(--theme-success-border))] hover:bg-[hsl(var(--theme-success-soft)/0.6)]",
      iconClassName: "bg-[hsl(var(--theme-success-soft))] text-[hsl(var(--theme-success-foreground))]",
      badgeVariant: "success" as const,
    },
    {
      key: "candidates" as const,
      count: session?.candidates.length ?? null,
      icon: Users,
      label: t("sessions.selection.candidates"),
      disabled: !session,
      activeClassName:
        "border-[hsl(var(--theme-accent-border))] bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))] shadow-sm",
      idleClassName:
        "border-border/80 bg-[hsl(var(--surface))] text-foreground hover:border-[hsl(var(--theme-accent-border))] hover:bg-[hsl(var(--theme-accent-soft)/0.6)]",
      iconClassName: "bg-[hsl(var(--theme-accent-soft))] text-[hsl(var(--theme-accent-soft-foreground))]",
      badgeVariant: "neutral" as const,
    },
    {
      key: "judges" as const,
      count: session?.judges.length ?? null,
      icon: ShieldCheck,
      label: t("sessions.selection.judges"),
      disabled: !session,
      activeClassName:
        "border-[hsl(var(--theme-warning-border))] bg-[hsl(var(--theme-warning-soft))] text-[hsl(var(--theme-warning-foreground))] shadow-sm",
      idleClassName:
        "border-border/80 bg-[hsl(var(--surface))] text-foreground hover:border-[hsl(var(--theme-warning-border))] hover:bg-[hsl(var(--theme-warning-soft)/0.6)]",
      iconClassName: "bg-[hsl(var(--theme-warning-soft))] text-[hsl(var(--theme-warning-foreground))]",
      badgeVariant: "success" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {steps.map((step) => {
        const Icon = step.icon;
        const isActive = step.key === activeStep;

        return (
          <button
            key={step.key}
            disabled={step.disabled}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition",
              isActive ? step.activeClassName : step.idleClassName,
              step.disabled && "cursor-not-allowed opacity-40",
            )}
            onClick={() => !step.disabled && onStepChange(step.key)}
            type="button"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-sm",
                    step.iconClassName,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold">{step.label}</p>
                  {step.count !== null ? (
                    <p className="text-[0.7rem] text-[hsl(var(--foreground-soft))]">
                      {t("sessions.selection.count", { count: step.count })}
                    </p>
                  ) : (
                    <p className="text-[0.7rem] text-[hsl(var(--foreground-soft))]">
                      {session ? t("sessions.selection.saved") : t("sessions.selection.new")}
                    </p>
                  )}
                </div>
              </div>
              {isActive ? (
                <Badge variant={step.badgeVariant} className="shrink-0 text-[0.6rem]">
                  {t("sessions.selection.current")}
                </Badge>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
