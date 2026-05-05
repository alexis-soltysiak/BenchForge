import { Badge } from "@/components/ui/badge";
import type { Contributor } from "../types";
import { GitHubAvatar } from "./github-avatar";

export function ContributorFeature({ contributor }: { contributor: Contributor }) {
  return (
    <a
      className="group block rounded-[1.45rem] border border-border/70 bg-[hsl(var(--surface-overlay))] p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.18)] transition hover:border-primary/25 hover:bg-[hsl(var(--surface-elevated))]"
      href={`https://github.com/${contributor.github}`}
      rel="noreferrer"
      target="_blank"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge className="uppercase tracking-[0.18em]" variant="accent">
              Master
            </Badge>
            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
              GitHub profile
            </span>
          </div>
          <h3 className="mt-3 text-[1.08rem] font-semibold tracking-tight text-foreground">
            @{contributor.github}
          </h3>
        </div>
        <GitHubAvatar
          github={contributor.github}
          label={contributor.github}
          size="lg"
        />
      </div>
    </a>
  );
}
