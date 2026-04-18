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

const flowSteps = [
  {
    id: "prompts",
    title: "Prompts",
    subtitle: "On crée le contenu à tester",
    description:
      "Tu centralises tes prompts, tes variantes et tes règles d'exécution pour garder une base propre et réutilisable.",
    icon: FileText,
    tone: "amber",
  },
  {
    id: "models",
    title: "Models",
    subtitle: "On référence les moteurs",
    description:
      "Tu enregistres les modèles, endpoints et paramètres pour comparer plusieurs fournisseurs ou configurations.",
    icon: Database,
    tone: "sky",
  },
  {
    id: "sessions",
    title: "Sessions",
    subtitle: "On assemble le scénario",
    description:
      "Tu combines prompts, modèles, candidats et juges dans une session de benchmark claire et rejouable.",
    icon: Layers3,
    tone: "emerald",
  },
  {
    id: "runs",
    title: "Runs",
    subtitle: "On lance et on mesure",
    description:
      "La session produit un run: exécution, suivi, arbitrage et lecture des résultats pour décider vite et bien.",
    icon: Activity,
    tone: "rose",
  },
] as const;

const howItWorks = [
  {
    step: "01",
    title: "Préparer les prompts",
    body: "Commence par écrire le problème, les contraintes et les variantes à comparer. BenchForge garde tout structuré.",
  },
  {
    step: "02",
    title: "Brancher les modèles",
    body: "Ajoute un ou plusieurs modèles, locaux ou distants. Tu peux ensuite mesurer les écarts avec la même base de test.",
  },
  {
    step: "03",
    title: "Composer une session",
    body: "Une session relie prompts, modèles et règles d'évaluation. C'est ton plan de benchmark, pas juste une liste d'items.",
  },
  {
    step: "04",
    title: "Lancer un run",
    body: "Le run exécute la session, collecte les réponses et prépare la lecture des résultats pour comparer proprement.",
  },
] as const;

const toneClasses: Record<
  (typeof flowSteps)[number]["tone"],
  { ring: string; chip: string; glow: string }
> = {
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
  const [markUnavailable, setMarkUnavailable] = useState(false);

  return (
    <div className="relative isolate overflow-hidden px-4 pb-8 pt-4 lg:px-8 lg:pt-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="absolute right-[-7rem] top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_30%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 rounded-[1.6rem] border border-white/70 bg-white/70 px-4 py-3 shadow-[0_18px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="group inline-flex min-h-12 items-center rounded-full border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)] ring-1 ring-white/80 transition-transform duration-200 hover:-translate-y-0.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,_rgba(255,248,235,0.96),_rgba(255,255,255,0.98))] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(15,23,42,0.55)]">
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
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-600">
                  BenchForge
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  Benchmark studio
                </p>
              </div>
            </div>

            <div className="hidden sm:block">
              <p className="text-[0.92rem] text-slate-600">
                Benchmark studio for prompts, models, sessions and runs.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="rounded-full"
              onClick={onNavigateToCredits}
              variant="ghost"
            >
              Credits
            </Button>
            <Button
              className="rounded-full"
              onClick={onNavigateToPrompts}
              variant="secondary"
            >
              Start with prompts
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-4">
            <Badge className="bg-slate-950 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white">
              How it works
            </Badge>

            <div className="max-w-3xl space-y-3">
              <h1 className="font-display text-[2.85rem] font-semibold tracking-tight text-slate-950 sm:text-[3.5rem]">
                Construis un parcours de benchmark lisible, du prompt au run.
              </h1>
              <p className="max-w-2xl text-[1rem] leading-7 text-slate-600">
                BenchForge est un espace simple et auto-hébergeable pour
                comparer des modèles avec la même base de test. Tu crées les
                prompts, tu enregistres les modèles, tu assembles les sessions,
                puis tu lances les runs et lis les résultats.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button className="rounded-full" onClick={onNavigateToSessions}>
                Explorer les sessions
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                className="rounded-full"
                onClick={onNavigateToRuns}
                variant="secondary"
              >
                Voir les runs
                <Activity className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  title: "Structuré",
                  text: "Chaque benchmark reste dans un modèle d'objet prévisible.",
                },
                {
                  title: "Rejouable",
                  text: "Les sessions permettent de relancer exactement la même base plus tard.",
                },
                {
                  title: "Lisible",
                  text: "Le chemin du prompt au résultat reste visible d'un coup d'œil.",
                },
              ].map((item) => (
                <Card
                  key={item.title}
                  className="border-white/80 bg-white/80 p-3 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.45)]"
                >
                  <p className="text-[0.92rem] font-semibold text-slate-950">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-[0.82rem] leading-5 text-slate-600">
                    {item.text}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="relative overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(248,250,252,0.92))] p-4 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.5)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(15,23,42,0.05),_transparent_45%)]" />
            <div className="relative space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Pipeline
                  </p>
                  <h2 className="mt-1.5 font-display text-[1.35rem] font-semibold tracking-tight text-slate-950">
                    Prompts, modèles, sessions, runs.
                  </h2>
                </div>
                <div className="rounded-[1rem] border border-slate-200 bg-white px-2.5 py-1.5 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Objectif
                  </p>
                  <p className="mt-1 text-[0.82rem] font-semibold text-slate-950">
                    Comparer, décider, recommencer.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {flowSteps.map((step, index) => {
                  const Icon = step.icon;
                  const tone = toneClasses[step.tone];
                  return (
                    <div key={step.id} className="relative">
                      {index < flowSteps.length - 1 ? (
                        <div className="absolute left-5 top-[3.85rem] h-7 w-px bg-gradient-to-b from-slate-200 to-transparent" />
                      ) : null}
                      <div className="flex gap-3 rounded-[1.35rem] border border-slate-200 bg-white/90 p-3 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.45)]">
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
                              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                                0{index + 1}
                              </p>
                              <h3 className="mt-0.5 text-[0.92rem] font-semibold text-slate-950">
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
                          <p className="mt-2 text-[0.8rem] leading-5 text-slate-600">
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
                  How to use it
                </p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-950">
                Un chemin simple de l'idée à l'évaluation.
                </h2>
              </div>
              <Button className="rounded-full" onClick={onNavigateToModels} variant="secondary">
              Configurer les modèles
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
                  Point de départ
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                  Crée d'abord les prompts, puis laisse le reste du pipeline
                  suivre.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
                  Le projet est volontairement ordonné. Si la couche prompts est
                  propre, le registre de modèles, le builder de sessions et les
                  résultats restent faciles à comprendre.
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
                  Prêt à lancer
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-950">
                  Compose une session et lance un run quand le setup est
                  stable.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Les sessions emballent le benchmark. Les runs l'exécutent.
                  Résultat: des comparaisons reproductibles, faciles à auditer et
                  à partager.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="flex flex-col gap-3 rounded-[2rem] border border-white/70 bg-white/70 px-5 py-5 shadow-[0_18px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-slate-600">
              BenchForge garde le chemin du benchmark visible du premier prompt
              au run final.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={onNavigateToPrompts} variant="secondary">
              Parcourir les prompts
            </Button>
            <Button className="rounded-full" onClick={onNavigateToSessions}>
              Ouvrir les sessions
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
