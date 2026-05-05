import { cn } from "@/lib/utils";
import { scoreToneClasses, formatScore } from "../utils";

export function ScoreBadge({ value }: { value: string | null | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        scoreToneClasses(value, "badge"),
      )}
    >
      {formatScore(value)}
    </span>
  );
}
