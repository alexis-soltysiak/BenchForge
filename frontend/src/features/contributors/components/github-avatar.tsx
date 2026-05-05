import { useState } from "react";
import { cn } from "@/lib/utils";

export function GitHubAvatar({
  github,
  label,
  size = "md",
}: {
  github: string;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);

  const sizeClass = {
    sm: "h-10 w-10 text-xs",
    md: "h-16 w-16 text-sm",
    lg: "h-24 w-24 text-base",
  }[size];

  if (failed) {
    return (
      <div
        aria-label={label}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))] font-semibold text-[hsl(var(--foreground-soft))] ring-2 ring-white/70 ring-offset-2 ring-offset-[hsl(var(--surface-overlay))]",
          sizeClass,
        )}
      >
        {label
          .split(/[\s._-]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("")}
      </div>
    );
  }

  return (
    <img
      alt={label}
      className={cn(
        "shrink-0 rounded-full border border-[hsl(var(--border))] object-cover ring-2 ring-white/70 ring-offset-2 ring-offset-[hsl(var(--surface-overlay))]",
        sizeClass,
      )}
      loading="lazy"
      onError={() => setFailed(true)}
      src={`https://github.com/${github}.png?size=160`}
    />
  );
}
