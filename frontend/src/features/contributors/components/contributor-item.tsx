import { Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Contributor } from "../types";
import { GitHubAvatar } from "./github-avatar";

export function ContributorItem({
  contributor,
  variant,
}: {
  contributor: Contributor;
  variant: "main" | "other";
}) {
  return (
    <a
      className={cn(
        "group block rounded-[1.2rem] border border-border/70 bg-[hsl(var(--surface-overlay))] transition",
        variant === "main"
          ? "shadow-[0_20px_50px_-34px_rgba(15,23,42,0.16)] hover:border-primary/25 hover:bg-[hsl(var(--surface-elevated))]"
          : "hover:border-border hover:bg-[hsl(var(--surface))]",
      )}
      href={`https://github.com/${contributor.github}`}
      rel="noreferrer"
      target="_blank"
    >
      <div
        className={cn(
          "flex items-center gap-3 p-3",
          variant === "main" ? "sm:p-4" : "sm:p-3.5",
        )}
      >
        <GitHubAvatar
          github={contributor.github}
          label={contributor.github}
          size={variant === "main" ? "lg" : "md"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge
              className="uppercase tracking-[0.18em]"
              variant={variant === "main" ? "accent" : "neutral"}
            >
              {variant === "main" ? "master" : "other"}
            </Badge>
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
              GitHub
            </span>
          </div>
          <p className="mt-2 truncate text-[1rem] font-semibold text-foreground">
            @{contributor.github}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] bg-[hsl(var(--surface-muted))] text-muted-foreground transition group-hover:text-foreground">
          <Github className="h-4.5 w-4.5" />
        </div>
      </div>
    </a>
  );
}
