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

type FlowTone = "amber" | "sky" | "emerald" | "rose";

const toneClasses: Record<FlowTone, { ring: string; chip: string; glow: string }> = {
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
};

export function HomePage({
  onNavigateToPrompts,
  onNavigateToModels,
  onNavigateToSessions,
  onNavigateToRuns,
  onNavigateToCredits,
}: HomePageProps) {
  const { t } = useTranslation();

  const flowSteps: Array<{
    id: string;
    title: string;
    subtitle: string;
    description: string;
    icon: typeof FileText;
    tone: FlowTone;
  }> = [
    {
      id: "prompts",
      title: t("nav.prompts.label"),
      subtitle: t("home.flowSteps.prompts.subtitle"),
      description: t("home.flowSteps.prompts.description"),
      icon: FileText,
      tone: "amber",
    },
    {
      id: "models",
      title: t("nav.models.label"),
      subtitle: t("home.flowSteps.models.subtitle"),
      description: t("home.flowSteps.models.description"),
      icon: Database,
      tone: "sky",
    },
    {
      id: "sessions",
      title: t("nav.sessions.label"),
      subtitle: t("home.flowSteps.sessions.subtitle"),
      description: t("home.flowSteps.sessions.description"),
      icon: Layers3,
      tone: "emerald",
    },
    {
      id: "runs",
      title: t("nav.runs.label"),
      subtitle: t("home.flowSteps.runs.subtitle"),
      description: t("home.flowSteps.runs.description"),
      icon: Activity,
      tone: "rose",
    },
  ];

  const howItWorks = [
    { step: "01", title: t("home.howToUse.steps.step01.title"), body: t("home.howToUse.steps.step01.body") },
    { step: "02", title: t("home.howToUse.steps.step02.title"), body: t("home.howToUse.steps.step02.body") },
    { step: "03", title: t("home.howToUse.steps.step03.title"), body: t("home.howToUse.steps.step03.body") },
    { step: "04", title: t("home.howToUse.steps.step04.title"), body: t("home.howToUse.steps.step04.body") },
  ];

  return (
    <div className="relative isolate overflow-hidden px-5 pb-10 pt-6 lg:px-10 lg:pt-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="absolute right-[-7rem] top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_30%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-10">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/70 px-5 py-4 shadow-[0_18px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_20px_30px_-20px_rgba(15,23,42,0.85)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                {t("common.benchforge")}
              </p>
              <p className="text-sm text-slate-600">
                {t("home.hero.description")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="rounded-full"
              onClick={onNavigateToCredits}
              variant="ghost"
            >
              {t("common.credits")}
            </Button>
            <Button
              className="rounded-full"
              onClick={onNavigateToPrompts}
              variant="secondary"
            >
              {t("home.hero.startWithPrompts")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-6">
            <Badge className="bg-slate-950 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white">
              {t("home.hero.badge")}
            </Badge>

            <div className="max-w-3xl space-y-5">
              <h1 className="font-display text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                {t("home.hero.title")}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                {t("home.hero.description")}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="rounded-full" onClick={onNavigateToSessions}>
                {t("home.hero.exploreSessions")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                className="rounded-full"
                onClick={onNavigateToRuns}
                variant="secondary"
              >
                {t("home.hero.viewRuns")}
                <Activity className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: t("home.pillars.structured.title"),
                  text: t("home.pillars.structured.text"),
                },
                {
                  title: t("home.pillars.replayable.title"),
                  text: t("home.pillars.replayable.text"),
                },
                {
                  title: t("home.pillars.readable.title"),
                  text: t("home.pillars.readable.text"),
                },
              ].map((item) => (
                <Card
                  key={item.title}
                  className="border-white/80 bg-white/80 p-4 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.45)]"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.text}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="relative overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(248,250,252,0.92))] p-5 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.5)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(15,23,42,0.05),_transparent_45%)]" />
            <div className="relative space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    {t("home.pipeline.eyebrow")}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-950">
                    {t("home.pipeline.title")}
                  </h2>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {t("home.pipeline.objectiveLabel")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {t("home.pipeline.objective")}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {flowSteps.map((step, index) => {
                  const Icon = step.icon;
                  const tone = toneClasses[step.tone];
                  return (
                    <div key={step.id} className="relative">
                      {index < flowSteps.length - 1 ? (
                        <div className="absolute left-6 top-[4.6rem] h-10 w-px bg-gradient-to-b from-slate-200 to-transparent" />
                      ) : null}
                      <div className="flex gap-4 rounded-[1.6rem] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.45)]">
                        <div
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1",
                            tone.ring,
                            tone.chip,
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                                0{index + 1}
                              </p>
                              <h3 className="mt-1 text-base font-semibold text-slate-950">
                                {step.title}
                              </h3>
                            </div>
                            <span
                              className={cn(
                                "rounded-full bg-gradient-to-r px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
                                tone.chip,
                              )}
                            >
                              {step.subtitle}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {t("home.howToUse.eyebrow")}
                </p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-950">
                  {t("home.howToUse.title")}
                </h2>
              </div>
              <Button className="rounded-full" onClick={onNavigateToModels} variant="secondary">
                {t("home.howToUse.configureModels")}
                <Workflow className="h-4 w-4" />
              </Button>
            </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {howItWorks.map((item) => (
              <Card
                key={item.step}
                className="group relative overflow-hidden border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.5)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_60px_-42px_rgba(15,23,42,0.6)]"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-slate-400 to-transparent opacity-75" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {item.step}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.body}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <Card className="border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_28px_80px_-48px_rgba(15,23,42,0.75)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
                  {t("home.cta.startingPoint.eyebrow")}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                  {t("home.cta.startingPoint.title")}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
                  {t("home.cta.startingPoint.description")}
                </p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
              <ArrowRight className="h-5 w-5 text-slate-700 lg:rotate-0" />
            </div>
          </div>

          <Card className="border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.5)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900">
                <Rocket className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  {t("home.cta.readyToLaunch.eyebrow")}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-950">
                  {t("home.cta.readyToLaunch.title")}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  {t("home.cta.readyToLaunch.description")}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="flex flex-col gap-3 rounded-[2rem] border border-white/70 bg-white/70 px-5 py-5 shadow-[0_18px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-slate-600">
              {t("home.cta.footer.text")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={onNavigateToPrompts} variant="secondary">
              {t("home.cta.footer.browsePrompts")}
            </Button>
            <Button className="rounded-full" onClick={onNavigateToSessions}>
              {t("home.cta.footer.openSessions")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
