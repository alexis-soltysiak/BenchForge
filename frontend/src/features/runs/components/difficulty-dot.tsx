import { cn } from "@/lib/utils";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "../constants";

export function DifficultyDot({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span
      className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white", DIFFICULTY_COLORS[level])}
      title={`Difficulté : ${DIFFICULTY_LABELS[level] ?? level}`}
    >
      {level}
    </span>
  );
}
