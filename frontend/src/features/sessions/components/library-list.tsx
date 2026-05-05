import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "./difficulty-badge";

export function LibraryList({
  items,
  onAdd,
}: {
  items: Array<{ id: number; label: string; meta: string; difficulty?: number | null }>;
  onAdd: (itemId: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("sessions.selection.library")}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">{t("sessions.selection.noItems")}</p>
      ) : (
        items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-[hsl(var(--surface))] px-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.difficulty != null ? <DifficultyBadge value={item.difficulty} /> : null}
                <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => onAdd(item.id)}>
              {t("sessions.selection.add")}
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
