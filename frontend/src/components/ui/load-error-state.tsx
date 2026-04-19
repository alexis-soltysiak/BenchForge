import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoadErrorStateProps = {
  className?: string;
  compact?: boolean;
  message: string;
  onRetry?: () => void;
  resourceLabel: string;
};

export function LoadErrorState({
  className,
  compact = false,
  message,
  onRetry,
  resourceLabel,
}: LoadErrorStateProps) {
  const { t } = useTranslation();
  const normalizedMessage = message.toLowerCase();

  let title: string;
  let description: string;

  if (normalizedMessage.includes("database unavailable")) {
    title = t("error.databaseOffline");
    description = t("error.databaseOfflineDesc", { resource: resourceLabel });
  } else if (normalizedMessage.includes("backend unavailable")) {
    title = t("error.backendOffline");
    description = t("error.backendOfflineDesc", { resource: resourceLabel });
  } else {
    title = t("error.unableToLoad", { resource: resourceLabel });
    description = message;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 border border-[hsl(var(--theme-danger-border))] bg-[hsl(var(--theme-danger-soft))] text-[hsl(var(--theme-danger-foreground))]",
        compact ? "rounded-2xl px-4 py-3" : "border-b px-5 py-4",
        className,
      )}
    >
      <div className="mt-0.5 rounded-xl bg-[hsl(var(--surface)/0.88)] p-2 text-[hsl(var(--theme-danger-foreground))] shadow-sm ring-1 ring-[hsl(var(--theme-danger-border)/0.85)]">
        <TriangleAlert className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--theme-danger-foreground))]">
          {title}
        </p>
        <p className="mt-1 text-sm leading-6 text-[hsl(var(--theme-danger-foreground)/0.92)]">
          {description}
        </p>
      </div>

      {!compact && onRetry ? (
        <Button
          className="shrink-0 border-[hsl(var(--theme-danger-border))] bg-[hsl(var(--surface)/0.92)] text-[hsl(var(--theme-danger-foreground))] hover:bg-[hsl(var(--surface))]"
          onClick={onRetry}
          size="sm"
          type="button"
          variant="secondary"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("error.retry")}
        </Button>
      ) : null}
    </div>
  );
}
