import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DIFFICULTY_STYLES } from "../constants";
import { DifficultyBadge } from "./difficulty-badge";

export function PromptFilters({
  categories,
  difficulties,
  selectedCategories,
  selectedDifficulties,
  onCategoriesChange,
  onDifficultiesChange,
}: {
  categories: Array<{ slug: string; name: string }>;
  difficulties: number[];
  selectedCategories: string[];
  selectedDifficulties: number[];
  onCategoriesChange: (v: string[]) => void;
  onDifficultiesChange: (v: number[]) => void;
}) {
  const { t } = useTranslation();

  const toggleCategory = (slug: string) =>
    onCategoriesChange(
      selectedCategories.includes(slug)
        ? selectedCategories.filter((s) => s !== slug)
        : [...selectedCategories, slug],
    );

  const toggleDifficulty = (d: number) =>
    onDifficultiesChange(
      selectedDifficulties.includes(d)
        ? selectedDifficulties.filter((x) => x !== d)
        : [...selectedDifficulties, d],
    );

  return (
    <div className="flex flex-col gap-3">
      {categories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("sessions.selection.filterCategory")}
          </span>
          {categories.map((cat) => {
            const active = selectedCategories.includes(cat.slug);
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => toggleCategory(cat.slug)}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg border px-3 text-[0.82rem] font-medium transition",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {difficulties.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("sessions.selection.filterDifficulty")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
          {difficulties.map((d) => {
            const active = selectedDifficulties.includes(d);
            const style = DIFFICULTY_STYLES[d] ?? "bg-slate-500 text-white";
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDifficulty(d)}
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition",
                  style,
                  active ? "opacity-100 ring-2 ring-current ring-offset-1" : "opacity-30 hover:opacity-70",
                )}
              >
                {d}
              </button>
            );
          })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { DifficultyBadge };
