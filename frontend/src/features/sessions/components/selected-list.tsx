import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "./difficulty-badge";

export function SelectedList({
  emptyMessage,
  items,
  onRemove,
}: {
  emptyMessage?: string;
  items: Array<{
    id: number;
    label: string;
    meta: string;
    difficulty?: number | null;
    samplingMode?: string | null;
    onToggleSamplingMode?: () => void;
  }>;
  onRemove: (itemId: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("sessions.selection.selected")}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">{emptyMessage ?? "Nothing selected yet."}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-[hsl(var(--surface-muted))] px-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.difficulty != null ? <DifficultyBadge value={item.difficulty} /> : null}
                <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.samplingMode != null && (
                <button
                  type="button"
                  onClick={item.onToggleSamplingMode}
                  className={`inline-flex items-center rounded-md px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide transition hover:opacity-80 ${
                    item.samplingMode === "iterative"
                      ? "bg-violet-100 text-violet-700"
                      : "bg-sky-100 text-sky-700"
                  }`}
                  title="Click to toggle sampling mode"
                >
                  {item.samplingMode === "iterative" ? "iterative" : "pass@k"}
                </button>
              )}
              <Button size="sm" variant="dangerSoft" onClick={() => onRemove(item.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
