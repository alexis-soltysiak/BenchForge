import { Crown, Sparkles, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import contributorsSource from "virtual:contributors-md";
import { Badge } from "@/components/ui/badge";
import { parseContributors } from "./utils";
import { ContributorFeature } from "./components/contributor-feature";
import { ContributorItem } from "./components/contributor-item";
import { EmptyState } from "./components/empty-state";

const contributors = parseContributors(contributorsSource);

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
