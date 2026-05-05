import { cn } from "@/lib/utils";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "../constants";

export function DifficultyDot({ level }: { level: number | null }) {
  if (!level) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border/40 text-[9px] font-bold text-muted-foreground" />
    );
  }
  return (
    <span
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white",
        DIFFICULTY_COLORS[level],
      )}
      title={DIFFICULTY_LABELS[level]}
    >
      {level}
    </span>
  );
}
