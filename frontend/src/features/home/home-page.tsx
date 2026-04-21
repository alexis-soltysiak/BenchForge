import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Layers3,
  Rocket,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HomePageProps = {
  onNavigateToPrompts: () => void;
  onNavigateToModels: () => void;
  onNavigateToSessions: () => void;
  onNavigateToRuns: () => void;
  onNavigateToCredits: () => void;
};

const toneClasses = {
  amber: {
    ring: "ring-amber-200/80",
    chip: "bg-amber-100 text-amber-900",
    glow: "from-amber-200/45",
  },
  sky: {
    ring: "ring-sky-200/80",
    chip: "bg-sky-100 text-sky-900",
    glow: "from-sky-200/45",
  },
  emerald: {
    ring: "ring-emerald-200/80",
    chip: "bg-emerald-100 text-emerald-900",
    glow: "from-emerald-200/45",
  },
  rose: {
    ring: "ring-rose-200/80",
    chip: "bg-rose-100 text-rose-900",
    glow: "from-rose-200/45",
  },
} as const;

export function HomePage({
  onNavigateToPrompts,
  onNavigateToModels,
  onNavigateToSessions,
  onNavigateToRuns,
  onNavigateToCredits,
}: HomePageProps) {
  const { t } = useTranslation();
  const [markUnavailable, setMarkUnavailable] = useState(false);

  const flowSteps = [
    {
      id: "prompts",
      title: "Prompts",
      subtitle: t("flow.prompts.subtitle"),
      description: t("flow.prompts.description"),
      icon: FileText,
      tone: "amber" as const,
    },
    {
      id: "models",
      title: "Models",
      subtitle: t("flow.models.subtitle"),
      description: t("flow.models.description"),
      icon: Database,
      tone: "sky" as const,
    },
    {
      id: "sessions",
      title: "Sessions",
      subtitle: t("flow.sessions.subtitle"),
      description: t("flow.sessions.description"),
      icon: Layers3,
      tone: "emerald" as const,
    },
    {
      id: "runs",
      title: "Runs",
      subtitle: t("flow.runs.subtitle"),
      description: t("flow.runs.description"),
      icon: Activity,
      tone: "rose" as const,
    },
  ];

  const howItWorks = [
    {
      step: "01",
      title: t("howItWorks.step1.title"),
      body: t("howItWorks.step1.body"),
    },
    {
      step: "02",
      title: t("howItWorks.step2.title"),
      body: t("howItWorks.step2.body"),
    },
    {
      step: "03",
      title: t("howItWorks.step3.title"),
      body: t("howItWorks.step3.body"),
    },
    {
      step: "04",
      title: t("howItWorks.step4.title"),
      body: t("howItWorks.step4.body"),
    },
  ];

  return (
    <div className="relative isolate overflow-hidden px-4 pb-8 pt-2 lg:px-8 lg:pt-3">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="absolute right-[-7rem] top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_30%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 rounded-[1.6rem] border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] px-4 py-3 shadow-[0_18px_70px_-40px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="group inline-flex min-h-12 items-center rounded-full border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface))] px-3 py-1.5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.2)] transition-transform duration-200 hover:-translate-y-0.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,_rgba(255,248,235,0.96),_rgba(255,255,255,0.98))] text-[hsl(var(--surface-strong))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(15,23,42,0.4)]">
                {!markUnavailable ? (
                  <img
                    alt=""
                    className="h-4 w-4 object-contain"
                    onError={() => setMarkUnavailable(true)}
                    src="/branding/benchforge-mark.png"
                  />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
              <div className="ml-3 min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--foreground-soft))]">
                  BenchForge
                </p>
                <p className="truncate text-[11px] text-[hsl(var(--foreground-soft))]">
                  {t("home.benchmarkStudio")}
                </p>
              </div>
            </div>

            <div className="hidden sm:block">
              <p className="text-[0.92rem] text-[hsl(var(--foreground-soft))]">
                {t("home.tagline")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="rounded-full"
              onClick={onNavigateToCredits}
              variant="ghost"
            >
              {t("home.credits")}
            </Button>
            <Button
              className="animate-btn-glow-amber group relative overflow-hidden rounded-full"
              onClick={onNavigateToPrompts}
              variant="secondary"
            >
              <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
              {t("home.startWithPrompts")}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-4">
            <Badge className="bg-[hsl(var(--surface-strong))] px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-[hsl(var(--surface-strong-foreground))]">
              {t("home.howItWorks")}
            </Badge>

            <div className="max-w-3xl space-y-3">
              <h1 className="font-display text-[2.4rem] font-semibold tracking-tight text-foreground sm:text-[3rem]">
                {t("home.mainHeading")}
              </h1>
              <p className="max-w-2xl text-[1rem] leading-7 text-[hsl(var(--foreground-soft))]">
                {t("home.mainDesc")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button className="animate-btn-glow-emerald group relative overflow-hidden rounded-full" onClick={onNavigateToSessions}>
                <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
                {t("home.exploreSessions")}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
              <Button
                className="animate-btn-glow-rose group relative overflow-hidden rounded-full"
                onClick={onNavigateToRuns}
                variant="secondary"
              >
                <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-rose-300/70 to-transparent" />
                {t("home.viewRuns")}
                <Activity className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
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
                <Card
                  key={item.title}
                  className="border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-3 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.22)]"
                >
                  <p className="text-[0.92rem] font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-[0.82rem] leading-5 text-[hsl(var(--foreground-soft))]">
                    {item.text}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="relative overflow-hidden border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-3 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.24)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(var(--primary)/0.1),_transparent_45%)]" />
            <div className="relative space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--foreground-soft))]">
                    {t("home.pipeline")}
                  </p>
                  <h2 className="mt-1.5 font-display text-[1.35rem] font-semibold tracking-tight text-foreground">
                    {t("home.pipelineSubtitle")}
                  </h2>
                </div>
                <div className="rounded-[1rem] border border-border bg-[hsl(var(--surface))] px-2.5 py-1.5 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--foreground-soft))]">
                    {t("home.objectif")}
                  </p>
                  <p className="mt-1 text-[0.82rem] font-semibold text-foreground">
                    {t("home.objectifValue")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {flowSteps.map((step, index) => {
                  const Icon = step.icon;
                  const tone = toneClasses[step.tone];
                  return (
                    <div key={step.id} className="relative">
                      {index < flowSteps.length - 1 ? (
                        <div className="absolute left-5 top-[3.85rem] h-7 w-px bg-gradient-to-b from-[hsl(var(--border))] to-transparent" />
                      ) : null}
                      <div className="flex gap-3 rounded-[1.35rem] border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface))] p-2.5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.22)]">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] ring-1",
                            tone.ring,
                            tone.chip,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[hsl(var(--foreground-soft))]">
                                0{index + 1}
                              </p>
                              <h3 className="mt-0.5 text-[0.92rem] font-semibold text-foreground">
                                {step.title}
                              </h3>
                            </div>
                            <span
                              className={cn(
                                "rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]",
                                tone.chip,
                              )}
                            >
                              {step.subtitle}
                            </span>
                          </div>
                          <p className="mt-2 text-[0.8rem] leading-5 text-[hsl(var(--foreground-soft))]">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </section>

        <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--foreground-soft))]">
                  {t("home.howToUseIt")}
                </p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                  {t("home.simplePathHeading")}
                </h2>
              </div>
              <Button className="animate-btn-glow-sky group relative overflow-hidden rounded-full" onClick={onNavigateToModels} variant="secondary">
                <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
                {t("home.configureModels")}
                <Workflow className="h-4 w-4" />
              </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {howItWorks.map((item) => (
                <Card
                  key={item.step}
                  className="group relative overflow-hidden border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.24)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_60px_-42px_rgba(15,23,42,0.32)]"
                >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[hsl(var(--surface-strong))] via-[hsl(var(--foreground-soft))] to-transparent opacity-75" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[hsl(var(--foreground-soft))]">
                  {item.step}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[hsl(var(--foreground-soft))]">
                  {item.body}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <Card className="border-[hsl(var(--surface-strong)/0.2)] bg-[hsl(var(--surface-strong))] p-6 text-[hsl(var(--surface-strong-foreground))] shadow-[0_28px_80px_-48px_rgba(15,23,42,0.42)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
                  {t("home.startingPoint")}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                  {t("home.startingPointHeading")}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
                  {t("home.startingPointDesc")}
                </p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-[hsl(var(--surface))] shadow-sm">
              <ArrowRight className="h-5 w-5 text-foreground lg:rotate-0" />
            </div>
          </div>

          <Card className="border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.24)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900">
                <Rocket className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--foreground-soft))]">
                  {t("home.readyToLaunch")}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                  {t("home.readyToLaunchHeading")}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--foreground-soft))]">
                  {t("home.readyToLaunchDesc")}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="flex flex-col gap-3 rounded-[2rem] border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] px-5 py-5 shadow-[0_18px_70px_-40px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-[hsl(var(--foreground-soft))]">
              {t("home.ctaDesc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="animate-btn-glow-amber group relative overflow-hidden rounded-full" onClick={onNavigateToPrompts} variant="secondary">
              <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
              {t("home.browsePrompts")}
            </Button>
            <Button className="animate-btn-glow-emerald group relative overflow-hidden rounded-full" onClick={onNavigateToSessions}>
              <span className="animate-btn-shimmer pointer-events-none absolute inset-[-20%] w-[140%] bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
              {t("home.openSessions")}
            </Button>
          </div>
        </section>
      </div>
      <div className="pointer-events-none sticky bottom-0 -mt-20 h-20 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
