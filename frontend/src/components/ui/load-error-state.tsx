import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoadErrorStateProps = {
  className?: string;
  compact?: boolean;
  message: string;
  onRetry?: () => void;
  resourceLabel: string;
};

function buildErrorCopy(message: string, resourceLabel: string): {
  description: string;
  title: string;
} {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("database unavailable")) {
    return {
      title: "Database offline",
      description: `BenchForge couldn't load ${resourceLabel} because the database connection is unavailable.`,
    };
  }

  if (normalizedMessage.includes("backend unavailable")) {
    return {
      title: "Backend offline",
      description: `BenchForge couldn't reach the API while loading ${resourceLabel}. Start the backend and try again.`,
    };
  }

  return {
    title: `Unable to load ${resourceLabel}`,
    description: message,
  };
}

export function LoadErrorState({
  className,
  compact = false,
  message,
  onRetry,
  resourceLabel,
}: LoadErrorStateProps) {
  const copy = buildErrorCopy(message, resourceLabel);

  return (
    <div
      className={cn(
        "flex items-start gap-3 border border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.98))] text-rose-950",
        compact ? "rounded-2xl px-4 py-3" : "border-b px-5 py-4",
        className,
      )}
    >
      <div className="mt-0.5 rounded-xl bg-white/80 p-2 text-rose-600 shadow-sm ring-1 ring-rose-200/80">
        <TriangleAlert className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
          {copy.title}
        </p>
        <p className="mt-1 text-sm leading-6 text-rose-950/90">{copy.description}</p>
      </div>

      {!compact && onRetry ? (
        <Button
          className="shrink-0 border-rose-200 bg-white/90 text-rose-800 hover:border-rose-300 hover:bg-rose-100"
          onClick={onRetry}
          size="sm"
          type="button"
          variant="secondary"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
