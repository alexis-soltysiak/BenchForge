import { cn } from "@/lib/utils";
import { DIFFICULTY_STYLES } from "../constants";

export function DifficultyBadge({ value }: { value: number }) {
  const style = DIFFICULTY_STYLES[value] ?? "bg-slate-500 text-white";
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        style,
      )}
    >
      {value}
    </span>
  );
}
