import { useMemo, useState } from "react";

import contributorsSource from "virtual:contributors-md";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Contributor = {
  github: string;
  main: boolean;
};

const contributors = parseContributors(contributorsSource);

function parseContributors(source: string): Contributor[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) =>
      line
        .replace(/^[*-]\s*/, "")
        .replace(/[()]/g, " ")
        .trim(),
    )
    .map((line) => {
      const tokens = line.split(/\s+/).filter(Boolean);
      const firstToken = tokens[0]?.toLowerCase() ?? "";
      const main = firstToken === "master" || firstToken === "main";
      const github = main ? (tokens[1] ?? "") : (tokens[0] ?? "");

      return { github, main };
    })
    .filter((contributor) => contributor.github.length > 0);
}

function GitHubAvatar({
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
          "flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 font-semibold text-slate-600",
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
        "shrink-0 rounded-full border border-slate-200 object-cover",
        sizeClass,
      )}
      loading="lazy"
      onError={() => setFailed(true)}
      src={`https://github.com/${github}.png?size=160`}
    />
  );
}

function ContributorItem({
  contributor,
  variant,
}: {
  contributor: Contributor;
  variant: "main" | "other";
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <div
        className={cn(
          "flex items-center gap-4 p-4",
          variant === "main" ? "sm:p-5" : "sm:p-4",
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
          </div>
          <p className="mt-2 truncate font-mono text-sm text-slate-700">
            @{contributor.github}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function ContributorsPage() {
  const { mainContributors, otherContributors } = useMemo(() => {
    return {
      mainContributors: contributors.filter((contributor) => contributor.main),
      otherContributors: contributors.filter((contributor) => !contributor.main),
    };
  }, []);

  return (
    <div className="min-h-screen bg-white px-5 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-500">
              Credits wall
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Contributors
            </h1>
          </div>
        </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Main contributors
          </h2>
          {mainContributors.length === 0 ? (
            <EmptyState text="No main contributors found." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {mainContributors.map((contributor) => (
                <ContributorItem
                  key={contributor.github}
                  contributor={contributor}
                  variant="main"
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Others
          </h2>
          {otherContributors.length === 0 ? (
            <EmptyState text="No other contributors found." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {otherContributors.map((contributor) => (
                <ContributorItem
                  key={contributor.github}
                  contributor={contributor}
                  variant="other"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
      {text}
    </div>
  );
}
