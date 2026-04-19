import { QueryClientProvider } from "@tanstack/react-query";
import {
  Activity,
  Database,
  FileText,
  Settings,
  Layers3,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ContributorsPage } from "@/features/contributors/contributors-page";
import { HomePage } from "@/features/home/home-page";
import { ModelRegistryPage } from "@/features/models/model-registry-page";
import { PromptLibraryPage } from "@/features/prompts/prompt-library-page";
import { RunDetailPage, RunsPage } from "@/features/runs/runs-page";
import { SessionsPage } from "@/features/sessions/sessions-page";
import { SettingsPage } from "@/features/settings/settings-page";
import {
  type AppTheme,
  type SettingsSection,
  applyTheme,
  getStoredTheme,
} from "@/features/settings/settings-preferences";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type View =
  | "home"
  | "prompts"
  | "models"
  | "sessions"
  | "runs"
  | "contributors"
  | "settings";

const navigationIcons: Record<Exclude<View, "home" | "contributors">, LucideIcon> = {
  prompts: FileText,
  models: Database,
  sessions: Layers3,
  runs: Activity,
  settings: Settings,
};

export function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("home");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("theme");
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme());
  const [markUnavailable, setMarkUnavailable] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const navigationItems: Array<{
    id: View;
    label: string;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      id: "prompts",
      label: t("nav.prompts.label"),
      description: t("nav.prompts.description"),
      icon: navigationIcons.prompts,
    },
    {
      id: "models",
      label: t("nav.models.label"),
      description: t("nav.models.description"),
      icon: navigationIcons.models,
    },
    {
      id: "sessions",
      label: t("nav.sessions.label"),
      description: t("nav.sessions.description"),
      icon: navigationIcons.sessions,
    },
    {
      id: "runs",
      label: t("nav.runs.label"),
      description: t("nav.runs.description"),
      icon: navigationIcons.runs,
    },
  ];

  useEffect(() => {
    const syncRoute = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const segments = hash.split("/").filter(Boolean);

      if (segments.length === 0) {
        setView("home");
        setSelectedRunId(null);
        return;
      }

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

      if (segments[0] === "settings") {
        setView("settings");
        setSelectedRunId(null);
        setSettingsSection(
          segments[1] === "api-keys"
            ? "api-keys"
            : segments[1] === "language"
              ? "language"
              : "theme",
        );
        return;
      }

      const nextView = segments[0];
      if (
        nextView === "home" ||
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

  const navigateToHome = () => {
    window.location.hash = "/";
  };

  const navigateToView = (nextView: View) => {
    if (nextView === "home") {
      navigateToHome();
      return;
    }
    if (nextView === "settings") {
      window.location.hash = `/settings/${settingsSection}`;
      return;
    }
    window.location.hash =
      nextView === "sessions" ? "/sessions" : `/${nextView}`;
  };

  const navigateToSettingsSection = (section: SettingsSection) => {
    window.location.hash = `/settings/${section}`;
  };

  const navigateToRun = (runId: number) => {
    window.location.hash = `/runs/${runId}`;
  };

  const navigateToRunsList = () => {
    window.location.hash = "/runs";
  };

  const activeView =
    navigationItems.find((item) => item.id === view) ?? navigationItems[0];
  const isRunDetailView = view === "runs" && selectedRunId !== null;
  const isHomeView = view === "home";
  const activeSectionLabel =
    view === "contributors" ? t("nav.contributors") : activeView.label;

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className={cn("min-h-screen", !isHomeView && "xl:pr-[17.25rem]")}
        style={{
          backgroundImage:
            isHomeView || isRunDetailView
              ? "none"
              : "radial-gradient(circle at top, var(--shell-glow), transparent 28%)",
        }}
      >
        {isHomeView ? (
          <HomePage
            onNavigateToPrompts={() => navigateToView("prompts")}
            onNavigateToModels={() => navigateToView("models")}
            onNavigateToRuns={() => navigateToView("runs")}
            onNavigateToSessions={() => navigateToView("sessions")}
            onNavigateToCredits={() => navigateToView("contributors")}
          />
        ) : (
          <>
            <div className="xl:hidden">
              <div className="mx-auto max-w-7xl px-5 pt-5 lg:px-10">
                <div className="rounded-[2rem] border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-5 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.2)]">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="space-y-2">
                        <button
                          className="group inline-flex min-h-12 items-center rounded-full border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface))] px-3 py-2 text-foreground shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[hsl(var(--surface-elevated))]"
                          onClick={navigateToHome}
                          type="button"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-slate-700" />
                          {t("nav.home")}
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,_rgba(255,248,235,0.96),_rgba(255,255,255,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_18px_-16px_rgba(15,23,42,0.42)]">
                            {!markUnavailable ? (
                              <img
                                alt=""
                                className="h-3.5 w-3.5 object-contain"
                                onError={() => setMarkUnavailable(true)}
                                src="/branding/benchforge-mark.png"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-slate-700">
                                B
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground">
                            BenchForge
                          </span>
                        </button>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--foreground-soft))]">
                            {activeSectionLabel}
                          </p>
                          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-950">
                            {t("nav.navigationRail")}
                          </h1>
                        </div>
                      </div>
                      <p className="max-w-sm text-sm leading-6 text-slate-600">
                        {t("nav.desktopNav")}
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
                                ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-lg shadow-slate-900/10"
                                : "border-border bg-[hsl(var(--surface-overlay))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
                            )}
                            onClick={() => navigateToView(item.id)}
                            type="button"
                          >
                            <span
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                                isActive
                                  ? "bg-[hsl(var(--surface-strong-foreground)/0.12)] text-current"
                                  : "bg-[hsl(var(--muted))] text-foreground",
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
                                  isActive
                                    ? "text-[hsl(var(--surface-strong-foreground)/0.76)]"
                                    : "text-[hsl(var(--foreground-soft))]",
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
                      <div className="flex items-center gap-2">
                        <button
                          className={cn(
                            "group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] transition",
                            view === "contributors"
                              ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-lg shadow-slate-900/10"
                              : "border-border bg-[hsl(var(--surface-overlay))] text-[hsl(var(--foreground-soft))] hover:bg-[hsl(var(--surface))] hover:text-foreground",
                          )}
                          onClick={() => navigateToView("contributors")}
                          title={t("nav.openContributors")}
                          type="button"
                        >
                          <UsersRound className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t("common.credits")}</span>
                          <span className="sr-only">{t("nav.openContributors")}</span>
                        </button>

                        <button
                          aria-current={view === "settings" ? "page" : undefined}
                          className={cn(
                            "group inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                            view === "settings"
                              ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-lg shadow-slate-900/10"
                              : "border-border bg-[hsl(var(--surface-overlay))] text-[hsl(var(--foreground-soft))] hover:bg-[hsl(var(--surface))] hover:text-foreground",
                          )}
                          onClick={() => navigateToView("settings")}
                          title={t("nav.openSettings")}
                          type="button"
                        >
                          <Settings className="h-4 w-4" />
                          <span className="sr-only">{t("nav.openSettings")}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="fixed inset-y-0 right-0 z-30 hidden w-[15.75rem] p-3 xl:block">
              <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-[hsl(var(--border)/0.75)] bg-[hsl(var(--surface-glass))] px-3.5 py-4 shadow-[0_34px_110px_-54px_rgba(15,23,42,0.3)] backdrop-blur-xl">
                <div className="absolute inset-x-0 top-0 h-40 bg-[var(--shell-rail-glow)]" />
                <div className="absolute -left-12 top-24 h-44 w-44 rounded-full bg-[hsl(var(--primary)/0.08)] blur-3xl" />
                <div className="absolute bottom-10 right-[-3.5rem] h-48 w-48 rounded-full bg-[var(--shell-rail-orb)] blur-3xl" />

                <div className="relative flex h-full flex-col">
                  <div className="mb-2 flex justify-end">
                    <button
                      className="group inline-flex min-h-10 items-center rounded-full border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface))] pl-2.5 pr-3 py-1.5 text-foreground shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[hsl(var(--surface-elevated))]"
                      onClick={navigateToHome}
                      type="button"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-slate-700" />
                      {t("common.benchforge")}
                      <span className="-ml-1.5 mr-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,_rgba(255,248,235,0.96),_rgba(255,255,255,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_18px_-16px_rgba(15,23,42,0.42)]">
                        {!markUnavailable ? (
                          <img
                            alt=""
                            className="h-3.5 w-3.5 object-contain"
                            onError={() => setMarkUnavailable(true)}
                            src="/branding/benchforge-mark.png"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-slate-700">
                            B
                          </span>
                        )}
                      </span>
                      <span className="text-[8.5px] font-semibold uppercase tracking-[0.24em] text-foreground">
                        BenchForge
                      </span>
                    </button>
                  </div>

                  <nav className="relative mt-5 space-y-2.5">
                    {navigationItems.map((item, index) => {
                      const Icon = item.icon;
                      const isActive = item.id === view;

                      return (
                        <button
                          key={item.id}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "group flex w-full flex-row-reverse items-center gap-3 rounded-[1.5rem] border px-3.5 py-3.5 text-right transition duration-200",
                            isActive
                              ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-[0_24px_50px_-30px_rgba(15,23,42,0.28)]"
                              : "border-[hsl(var(--border)/0.7)] bg-[hsl(var(--surface-overlay))] text-foreground hover:bg-[hsl(var(--surface))]",
                          )}
                          onClick={() => navigateToView(item.id)}
                          type="button"
                        >
                            <span
                              className={cn(
                                "flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-[1rem] transition-colors",
                                isActive
                                  ? "bg-[hsl(var(--surface-strong-foreground)/0.12)] text-current"
                                  : "bg-[hsl(var(--muted))] text-foreground group-hover:bg-[hsl(var(--surface-muted))]",
                              )}
                            >
                            <Icon className="h-[1.05rem] w-[1.05rem]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-3">
                              <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground-soft))]">
                                0{index + 1}
                              </span>
                              <span className="truncate text-[0.84rem] font-semibold leading-4">
                                {item.label}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[0.67rem] leading-4 text-[hsl(var(--foreground-soft))]">
                              {item.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </nav>

                  <div className="mt-auto flex justify-end gap-2 pt-5">
                    <button
                      className={cn(
                        "group inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[8.5px] font-semibold uppercase tracking-[0.18em] transition",
                        view === "contributors"
                          ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-[0_18px_30px_-24px_rgba(15,23,42,0.24)]"
                          : "border-[hsl(var(--surface-strong)/0.22)] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground)/0.9)] hover:brightness-[1.06]",
                      )}
                      onClick={() => navigateToView("contributors")}
                      title={t("nav.openContributors")}
                      type="button"
                    >
                      <UsersRound className="h-3.5 w-3.5 text-white/90" />
                      <span>{t("common.credits")}</span>
                    </button>

                    <button
                      aria-current={view === "settings" ? "page" : undefined}
                      className={cn(
                        "group inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-full border transition",
                        view === "settings"
                          ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-[0_18px_30px_-24px_rgba(15,23,42,0.24)]"
                          : "border-border bg-[hsl(var(--surface-overlay))] text-[hsl(var(--foreground-soft))] hover:bg-[hsl(var(--surface))] hover:text-foreground",
                      )}
                      onClick={() => navigateToView("settings")}
                      title={t("nav.openSettings")}
                      type="button"
                    >
                      <Settings className="h-4 w-4" />
                      <span className="sr-only">{t("nav.openSettings")}</span>
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
              {view === "settings" ? (
                <SettingsPage
                  activeSection={settingsSection}
                  currentTheme={theme}
                  onNavigateToSection={navigateToSettingsSection}
                  onThemeChange={setTheme}
                />
              ) : null}
              {view === "runs" && selectedRunId === null ? (
                <RunsPage onOpenRun={navigateToRun} />
              ) : null}
              {view === "runs" && selectedRunId !== null ? (
                <RunDetailPage onBack={navigateToRunsList} runId={selectedRunId} />
              ) : null}
            </main>
          </>
        )}
      </div>
    </QueryClientProvider>
  );
}
