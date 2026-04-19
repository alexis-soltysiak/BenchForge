import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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

function ContributorItem({
  contributor,
  variant,
}: {
  contributor: Contributor;
  variant: "main" | "other";
}) {
  return (
    <Card className="border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] shadow-sm">
      <div
        className={cn(
          "flex items-center gap-3 p-3",
          variant === "main" ? "sm:p-4" : "sm:p-3",
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
          <p className="mt-1.5 truncate font-mono text-[0.92rem] text-[hsl(var(--foreground-soft))]">
            @{contributor.github}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function ContributorsPage() {
  const { t } = useTranslation();
  const { mainContributors, otherContributors } = useMemo(() => {
    return {
      mainContributors: contributors.filter((contributor) => contributor.main),
      otherContributors: contributors.filter((contributor) => !contributor.main),
    };
  }, []);

  return (
    <div className="min-h-screen px-3 py-5 lg:px-6 lg:py-6 xl:px-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="border-b border-border pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[hsl(var(--foreground-soft))]">
              {t("contributors.creditsWall")}
            </p>
            <h1 className="text-[1.9rem] font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
              {t("contributors.pageTitle")}
            </h1>
          </div>
        </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-[hsl(var(--foreground-soft))]">
            {t("contributors.mainContributors")}
          </h2>
          {mainContributors.length === 0 ? (
            <EmptyState text={t("contributors.noMain")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-[hsl(var(--foreground-soft))]">
            {t("contributors.others")}
          </h2>
          {otherContributors.length === 0 ? (
            <EmptyState text={t("contributors.noOthers")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
    <div className="rounded-[1.2rem] border border-dashed border-border bg-[hsl(var(--surface-muted))] px-4 py-6 text-[0.92rem] text-[hsl(var(--foreground-soft))]">
      {text}
    </div>
  );
}
