import { Crown, Github, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import contributorsSource from "virtual:contributors-md";
import { Badge } from "@/components/ui/badge";
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

function ContributorFeature({
  contributor,
}: {
  contributor: Contributor;
}) {
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

export function ContributorsPage() {
  const { t } = useTranslation();
  const { mainContributors, otherContributors } = useMemo(() => {
    return {
      mainContributors: contributors.filter((contributor) => contributor.main),
      otherContributors: contributors.filter((contributor) => !contributor.main),
    };
  }, []);
  const totalContributors = contributors.length;

  return (
    <div className="text-foreground">
      <header className="px-6 pb-6 pt-8 border-b border-border/50 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.28em] text-primary/80">
              {t("contributors.creditsWall")}
            </p>
            <h1 className="text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
              {t("contributors.pageTitle")}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <UsersRound className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{totalContributors}</span> profils
                </span>
              </div>
              <span className="mx-1.5 text-border/60">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Crown className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{mainContributors.length}</span> profils principaux
                </span>
              </div>
              <span className="mx-1.5 text-border/60">·</span>
              <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{otherContributors.length}</span> autres contributeurs
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-[1.5rem] border border-border/60 bg-[hsl(var(--surface-overlay))] p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.12)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
                  {t("contributors.mainContributors")}
                </p>
                <h2 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-foreground">
                  Noyau du projet
                </h2>
              </div>
              <Badge className="w-fit whitespace-nowrap text-[0.7rem]" variant="accent">
                {mainContributors.length} profils clés
              </Badge>
            </div>
            {mainContributors.length === 0 ? (
              <div className="mt-5">
                <EmptyState text={t("contributors.noMain")} />
              </div>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {mainContributors.map((contributor) => (
                  <ContributorFeature
                    key={contributor.github}
                    contributor={contributor}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("contributors.others")}
                </p>
                <h2 className="mt-1 text-[1.15rem] font-semibold tracking-tight text-foreground">
                  Mur de crédits
                </h2>
              </div>
              <Badge className="whitespace-nowrap text-[0.7rem]" variant="muted">
                GitHub handles
              </Badge>
            </div>
            {otherContributors.length === 0 ? (
              <EmptyState text={t("contributors.noOthers")} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
