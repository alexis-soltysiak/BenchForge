import {
  Activity,
  ArrowRight,
  Database,
  FileText,
  Layers3,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HomePageProps, QuickLink } from "./types";
import { toneClasses } from "./constants";

export function HomePage({
  onNavigateToPrompts,
  onNavigateToModels,
  onNavigateToSessions,
  onNavigateToRuns,
  onNavigateToCredits,
}: HomePageProps) {
  const { t } = useTranslation();
  const [markUnavailable, setMarkUnavailable] = useState(false);

  const quickLinks: QuickLink[] = [
    {
      id: "prompts",
      title: "Prompts",
      subtitle: t("flow.prompts.subtitle"),
      icon: FileText,
      onClick: onNavigateToPrompts,
      tone: "amber",
    },
    {
      id: "models",
      title: "Models",
      subtitle: t("flow.models.subtitle"),
      icon: Database,
      onClick: onNavigateToModels,
      tone: "sky",
    },
    {
      id: "sessions",
      title: "Sessions",
      subtitle: t("flow.sessions.subtitle"),
      icon: Layers3,
      onClick: onNavigateToSessions,
      tone: "emerald",
    },
    {
      id: "runs",
      title: "Runs",
      subtitle: t("flow.runs.subtitle"),
      icon: Activity,
      onClick: onNavigateToRuns,
      tone: "rose",
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-x-hidden text-foreground lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
      <div className="absolute inset-0 bg-[var(--hero-bg)] opacity-90" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.14)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.14)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      <div className="absolute left-[8%] top-[14%] h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-[14%] right-[10%] h-44 w-44 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col lg:h-full">
        <header className="border-b border-border/50 px-6 pb-4 pt-6 lg:px-8 lg:pb-4 lg:pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-[hsl(var(--surface-overlay))] shadow-[0_16px_36px_-24px_rgba(15,23,42,0.22)] backdrop-blur">
                {!markUnavailable ? (
                  <img
                    alt=""
                    className="h-4.5 w-4.5 object-contain"
                    onError={() => setMarkUnavailable(true)}
                    src="/branding/benchforge-mark.png"
                  />
                ) : (
                  <Sparkles className="h-4.5 w-4.5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.28em] text-primary/80">
                  BenchForge
                </p>
                <p className="text-[0.84rem] text-muted-foreground">
                  {t("home.benchmarkStudio")}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={onNavigateToCredits} variant="ghost">
                {t("home.credits")}
              </Button>
              <Button
                className="animate-btn-glow-amber group relative overflow-hidden"
                onClick={onNavigateToPrompts}
              >
                <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
                <span className="relative z-[1] flex items-center gap-2">
                  {t("home.startWithPrompts")}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-5 lg:min-h-0 lg:px-8 lg:py-4">
          <div className="grid gap-4 lg:h-full lg:grid-cols-[minmax(0,1.15fr)_24rem] lg:grid-rows-[minmax(0,1fr)_auto]">
            <section className="flex flex-col rounded-[2rem] border border-border/60 bg-[hsl(var(--surface-overlay))] p-5 shadow-[0_32px_90px_-55px_rgba(15,23,42,0.24)] backdrop-blur lg:min-h-0 lg:p-5">
              <div className="flex items-center gap-2">
                <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                  {t("home.howItWorks")}
                </Badge>
                <span className="text-[0.78rem] text-muted-foreground">
                  {t("home.objectifValue")}
                </span>
              </div>

              <div className="mt-4 max-w-3xl">
                <h1 className="font-display text-[2.2rem] font-semibold leading-[0.98] tracking-tight text-foreground lg:text-[2.95rem]">
                  {t("home.mainHeading")}
                </h1>
                <p className="mt-3 max-w-2xl text-[0.95rem] leading-6 text-muted-foreground lg:text-[0.9rem]">
                  {t("home.mainDesc")}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="animate-btn-glow-emerald group relative overflow-hidden"
                  onClick={onNavigateToSessions}
                >
                  <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
                  <span className="relative z-[1] flex items-center gap-2">
                    {t("home.exploreSessions")}
                    <Layers3 className="h-4 w-4" />
                  </span>
                </Button>
                <Button
                  className="animate-btn-glow-rose group relative overflow-hidden"
                  onClick={onNavigateToRuns}
                  variant="secondary"
                >
                  <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-rose-300/70 to-transparent" />
                  <span className="relative z-[1] flex items-center gap-2">
                    {t("home.viewRuns")}
                    <Activity className="h-4 w-4" />
                  </span>
                </Button>
                <Button
                  className="animate-btn-glow-sky group relative overflow-hidden"
                  onClick={onNavigateToModels}
                  variant="secondary"
                >
                  <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
                  <span className="relative z-[1] flex items-center gap-2">
                    {t("home.configureModels")}
                    <Database className="h-4 w-4" />
                  </span>
                </Button>
              </div>

              <div className="mt-5 lg:mt-auto">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      title: t("home.feature.structured"),
                      text: t("home.feature.structuredDesc"),
                    },
                    {
                      title: t("home.feature.replayable"),
                      text: t("home.feature.replayableDesc"),
                    },
                    {
                      title: t("home.feature.readable"),
                      text: t("home.feature.readableDesc"),
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[1.15rem] border border-border/60 bg-[hsl(var(--surface))] px-3.5 py-3.5 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.18)]"
                    >
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1.5 text-[0.84rem] leading-5 text-foreground">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="rounded-[2rem] border border-border/60 bg-[hsl(var(--surface-overlay))] p-4 shadow-[0_32px_90px_-55px_rgba(15,23,42,0.24)] backdrop-blur lg:min-h-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Pipeline
                  </p>
                  <h2 className="mt-1 text-[1.15rem] font-semibold tracking-tight text-foreground">
                    Du setup au run
                  </h2>
                </div>
                <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                  {quickLinks.length} zones
                </Badge>
              </div>

              <div className="mt-3 space-y-2.5">
                {quickLinks.map((item, index) => {
                  const Icon = item.icon;
                  const tone = toneClasses[item.tone];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className="group relative w-full overflow-hidden rounded-[1.25rem] border border-border/60 bg-[hsl(var(--surface))] px-3.5 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_40px_-30px_rgba(15,23,42,0.2)]"
                    >
                      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", tone.line)} />
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.icon)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  0{index + 1}
                                </span>
                                <p className="truncate text-[0.94rem] font-semibold text-foreground">
                                  {item.title}
                                </p>
                              </div>
                              <p className="mt-1 text-[0.72rem] uppercase tracking-[0.16em] text-primary">
                                {item.subtitle}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground" />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="lg:col-span-2">
              <div className="flex flex-col gap-3 rounded-[1.4rem] border border-border/60 bg-[hsl(var(--surface-overlay))] px-5 py-3.5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[0.9rem] text-muted-foreground">
                  {t("home.ctaDesc")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onNavigateToPrompts} variant="secondary">
                    {t("home.browsePrompts")}
                  </Button>
                  <Button onClick={onNavigateToSessions}>
                    {t("home.openSessions")}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
