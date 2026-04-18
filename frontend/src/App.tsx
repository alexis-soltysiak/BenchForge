import { QueryClientProvider } from "@tanstack/react-query";
import {
  Activity,
  Database,
  FileText,
  Layers3,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ContributorsPage } from "@/features/contributors/contributors-page";
import { ModelRegistryPage } from "@/features/models/model-registry-page";
import { PromptLibraryPage } from "@/features/prompts/prompt-library-page";
import { RunDetailPage, RunsPage } from "@/features/runs/runs-page";
import { SessionsPage } from "@/features/sessions/sessions-page";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type View = "prompts" | "models" | "sessions" | "runs" | "contributors";

const navigationItems: Array<{
  id: View;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "prompts",
    label: "Prompt Library",
    description: "Reusable prompt assets",
    icon: FileText,
  },
  {
    id: "models",
    label: "Model Registry",
    description: "Profiles and endpoints",
    icon: Database,
  },
  {
    id: "sessions",
    label: "Sessions",
    description: "Benchmark configuration",
    icon: Layers3,
  },
  {
    id: "runs",
    label: "Runs",
    description: "Execution and judging",
    icon: Activity,
  },
];

const viewThemes: Record<
  View,
  {
    brandAccent: string;
    pageGlow: string;
    railGlow: string;
    railOrb: string;
  }
> = {
  prompts: {
    brandAccent: "text-amber-500",
    pageGlow: "rgba(251, 191, 36, 0.14)",
    railGlow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_55%)]",
    railOrb: "bg-[rgba(251,191,36,0.12)]",
  },
  models: {
    brandAccent: "text-sky-500",
    pageGlow: "rgba(59, 130, 246, 0.14)",
    railGlow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_55%)]",
    railOrb: "bg-[rgba(59,130,246,0.12)]",
  },
  sessions: {
    brandAccent: "text-emerald-500",
    pageGlow: "rgba(16, 185, 129, 0.14)",
    railGlow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_55%)]",
    railOrb: "bg-[rgba(16,185,129,0.12)]",
  },
  runs: {
    brandAccent: "text-red-500",
    pageGlow: "rgba(239, 68, 68, 0.1)",
    railGlow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.14),_transparent_55%)]",
    railOrb: "bg-[rgba(239,68,68,0.09)]",
  },
  contributors: {
    brandAccent: "text-slate-950",
    pageGlow: "rgba(0, 0, 0, 0.05)",
    railGlow:
      "bg-[radial-gradient(circle_at_top_right,_rgba(0,0,0,0.18),_transparent_58%)]",
    railOrb: "bg-[rgba(0,0,0,0.08)]",
  },
};

export function App() {
  const [view, setView] = useState<View>("sessions");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  useEffect(() => {
    const syncRoute = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const segments = hash.split("/").filter(Boolean);

      if (segments[0] === "runs") {
        setView("runs");
        if (segments[1]) {
          const parsed = Number(segments[1]);
          setSelectedRunId(Number.isFinite(parsed) ? parsed : null);
          return;
        }
        setSelectedRunId(null);
        return;
      }

      const nextView = segments[0];
      if (
        nextView === "prompts" ||
        nextView === "models" ||
        nextView === "sessions" ||
        nextView === "contributors"
      ) {
        setView(nextView);
        setSelectedRunId(null);
        return;
      }

      setView("sessions");
      setSelectedRunId(null);
    };

    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  const navigateToView = (nextView: View) => {
    window.location.hash =
      nextView === "sessions" ? "/sessions" : `/${nextView}`;
  };

  const navigateToRun = (runId: number) => {
    window.location.hash = `/runs/${runId}`;
  };

  const navigateToRunsList = () => {
    window.location.hash = "/runs";
  };

  const activeView =
    navigationItems.find((item) => item.id === view) ?? navigationItems[0];
  const activeTheme = viewThemes[view];
  const isRunDetailView = view === "runs" && selectedRunId !== null;
  const activeSectionLabel =
    view === "contributors" ? "Contributors" : activeView.label;

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className="min-h-screen xl:pr-[23rem]"
        style={{
          backgroundImage: isRunDetailView
            ? "none"
            : `radial-gradient(circle at top, ${activeTheme.pageGlow}, transparent 28%)`,
        }}
      >
        <div className="xl:hidden">
          <div className="mx-auto max-w-7xl px-5 pt-5 lg:px-10">
            <div className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.55)]">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 shadow-sm">
                      <Sparkles className="h-3.5 w-3.5 text-slate-700" />
                      BenchForge Workspace
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {activeSectionLabel}
                      </p>
                      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-950">
                        Navigation rail
                      </h1>
                    </div>
                  </div>
                  <p className="max-w-sm text-sm leading-6 text-slate-600">
                    Desktop gets the right-side sticky navigation. Mobile keeps
                    the same sections in a lighter compact strip.
                  </p>
                </div>

                <nav className="flex gap-2 overflow-x-auto pb-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === view;

                    return (
                      <button
                        key={item.id}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group flex min-w-[13rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                          isActive
                            ? "border-slate-900 bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                            : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                        )}
                        onClick={() => navigateToView(item.id)}
                        type="button"
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                            isActive
                              ? "bg-white/12 text-white"
                              : "bg-slate-100 text-slate-700",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {item.label}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block text-xs leading-5",
                              isActive ? "text-slate-300" : "text-slate-500",
                            )}
                          >
                            {item.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </nav>

                <div className="mt-3 flex justify-end">
                  <button
                    className={cn(
                      "group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] transition",
                      view === "contributors"
                        ? "border-slate-900 bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                        : "border-slate-200 bg-white/75 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-800",
                    )}
                    onClick={() => navigateToView("contributors")}
                    title="Open contributors"
                    type="button"
                  >
                    <UsersRound className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Credits</span>
                    <span className="sr-only">Open contributors</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="fixed inset-y-0 right-0 z-30 hidden w-[21rem] p-5 xl:block">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[2.4rem] border border-white/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.86),_rgba(241,245,249,0.78))] px-5 py-6 shadow-[0_34px_110px_-54px_rgba(15,23,42,0.75)] backdrop-blur-xl">
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-40",
                activeTheme.railGlow,
              )}
            />
            <div className="absolute -left-12 top-24 h-44 w-44 rounded-full bg-[rgba(15,23,42,0.04)] blur-3xl" />
            <div
              className={cn(
                "absolute bottom-10 right-[-3.5rem] h-48 w-48 rounded-full blur-3xl",
                activeTheme.railOrb,
              )}
            />

            <div className="relative flex h-full flex-col">
              <div className="mb-4 flex justify-end">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-slate-700" />
                  BenchForge
                </span>
              </div>

              <nav className="relative mt-8 space-y-3">
                {navigationItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = item.id === view;

                  return (
                    <button
                      key={item.id}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex w-full flex-row-reverse items-center gap-4 rounded-[1.8rem] border px-4 py-4 text-right transition duration-200",
                        isActive
                          ? "border-slate-900 bg-slate-950 text-white shadow-[0_24px_50px_-30px_rgba(15,23,42,0.95)]"
                          : "border-white/70 bg-white/75 text-slate-700 hover:border-slate-300 hover:bg-white",
                      )}
                      onClick={() => navigateToView(item.id)}
                      type="button"
                    >
                      <span
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
                          isActive
                            ? "bg-white/12 text-white"
                            : "bg-slate-100 text-slate-700 group-hover:bg-slate-200",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            0{index + 1}
                          </span>
                          <span className="truncate text-sm font-semibold">
                            {item.label}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto flex justify-end pt-6">
                <button
                  className={cn(
                    "group inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] transition",
                    view === "contributors"
                      ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_30px_-24px_rgba(15,23,42,0.85)]"
                      : "border-slate-200 bg-slate-950 text-white/90 hover:border-slate-950 hover:bg-slate-900 hover:text-white",
                  )}
                  onClick={() => navigateToView("contributors")}
                  title="Open contributors"
                  type="button"
                >
                  <UsersRound className="h-3.5 w-3.5 text-white/90" />
                  <span>Credits</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="pb-8">
          {view === "prompts" ? <PromptLibraryPage /> : null}
          {view === "models" ? <ModelRegistryPage /> : null}
          {view === "sessions" ? (
            <SessionsPage
              onOpenRun={(runId) => {
                navigateToRun(runId);
              }}
            />
          ) : null}
          {view === "contributors" ? <ContributorsPage /> : null}
          {view === "runs" && selectedRunId === null ? (
            <RunsPage onOpenRun={navigateToRun} />
          ) : null}
          {view === "runs" && selectedRunId !== null ? (
            <RunDetailPage onBack={navigateToRunsList} runId={selectedRunId} />
          ) : null}
        </main>
      </div>
    </QueryClientProvider>
  );
}
