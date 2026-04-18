import {
  Check,
  Globe,
  KeyRound,
  Languages,
  LockKeyhole,
  MoonStar,
  Palette,
  SunMedium,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type AppTheme,
  type SettingsSection,
  applyTheme,
  persistApiKeyPreferences,
  persistTheme,
  readApiKeyPreferences,
} from "@/features/settings/settings-preferences";
import { cn } from "@/lib/utils";

type SettingsPageProps = {
  activeSection: SettingsSection;
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onNavigateToSection: (section: SettingsSection) => void;
};

const settingsSections: Array<{
  id: SettingsSection;
  title: string;
  description: string;
  icon: typeof Palette;
}> = [
  {
    id: "theme",
    title: "Theme",
    description: "Choisir l’ambiance visuelle du workspace",
    icon: Palette,
  },
  {
    id: "api-keys",
    title: "API Keys",
    description: "Renseigner des clés locales pour les providers",
    icon: KeyRound,
  },
  {
    id: "language",
    title: "Language",
    description: "Préparer la langue de l’interface",
    icon: Languages,
  },
];

const themeOptions: Array<{
  id: AppTheme;
  name: string;
  description: string;
  icon: typeof SunMedium;
  previewClassName: string;
}> = [
  {
    id: "warm",
    name: "Warm Studio",
    description: "Le thème actuel, clair et légèrement crème.",
    icon: SunMedium,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(255,252,245,1),_rgba(245,247,250,1))]",
  },
  {
    id: "light",
    name: "Paper Light",
    description: "Une version plus nette, plus froide, très lumineuse.",
    icon: Palette,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(255,255,255,1),_rgba(239,246,255,1))]",
  },
  {
    id: "night",
    name: "Night Slate",
    description: "Un thème sombre pour les longues sessions.",
    icon: MoonStar,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,1))]",
  },
];

const languageOptions = [
  {
    id: "fr",
    label: "Francais",
    nativeLabel: "Français",
    description: "Interface orientee FR pour le studio et les pages internes.",
    badge: "Default draft",
  },
  {
    id: "en",
    label: "English",
    nativeLabel: "English",
    description: "Interface orientee EN pour un usage plus international.",
    badge: "Ready for later",
  },
] as const;

export function SettingsPage({
  activeSection,
  currentTheme,
  onThemeChange,
  onNavigateToSection,
}: SettingsPageProps) {
  const [apiKeys, setApiKeys] = useState(() => readApiKeyPreferences());
  const [selectedLanguage, setSelectedLanguage] = useState<"fr" | "en">("fr");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const activeSectionMeta = useMemo(
    () => settingsSections.find((section) => section.id === activeSection),
    [activeSection],
  );

  const handleThemeSelect = (theme: AppTheme) => {
    persistTheme(theme);
    applyTheme(theme);
    onThemeChange(theme);
  };

  const handleSaveApiKeys = () => {
    persistApiKeyPreferences(apiKeys);
    setSaveMessage("Saved locally in this browser.");
  };

  return (
    <div className="w-full px-5 pt-5 lg:px-10 xl:pr-6">
      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="h-fit border-white/80 bg-white/80 p-4 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.45)] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Settings
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950">
            Workspace preferences
          </h1>
          <div className="mt-6 space-y-2">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;

              return (
                <button
                  key={section.id}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.85)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                  onClick={() => onNavigateToSection(section.id)}
                  type="button"
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                      isActive ? "bg-white/12" : "bg-slate-100",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {section.title}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-xs leading-5",
                        isActive ? "text-slate-300" : "text-slate-500",
                      )}
                    >
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="relative overflow-hidden border-white/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(248,250,252,0.92))] p-6 shadow-[0_32px_90px_-55px_rgba(15,23,42,0.55)]">
            <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_60%)]" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                {activeSectionMeta?.title ?? "Settings"}
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-950">
                {activeSection === "theme"
                  ? "Theme page"
                  : activeSection === "api-keys"
                    ? "API Key page"
                    : "Language page"}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {activeSection === "theme"
                  ? "Chaque sélection applique immédiatement une ambiance globale à BenchForge."
                  : activeSection === "api-keys"
                    ? "Ces clés sont enregistrées localement dans le navigateur. Elles ne sont pas envoyées au backend pour le moment."
                    : "UI only pour l’instant. Cette page prépare le futur choix de langue sans brancher encore la traduction réelle."}
              </p>
            </div>
          </Card>

          {activeSection === "theme" ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = option.id === currentTheme;

                return (
                  <Card
                    key={option.id}
                    className={cn(
                      "overflow-hidden border p-4 transition",
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.95)]"
                        : "border-white/80 bg-white/85 hover:-translate-y-0.5 hover:border-slate-300",
                    )}
                  >
                    <div
                      className={cn(
                        "h-28 rounded-[1.25rem] border",
                        isActive ? "border-white/10" : "border-slate-200",
                        option.previewClassName,
                      )}
                    />
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <p className="text-sm font-semibold">{option.name}</p>
                        </div>
                        <p
                          className={cn(
                            "mt-2 text-sm leading-6",
                            isActive ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          {option.description}
                        </p>
                      </div>
                      {isActive ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : null}
                    </div>
                    <Button
                      className="mt-4 w-full"
                      onClick={() => handleThemeSelect(option.id)}
                      variant={isActive ? "secondary" : "primary"}
                    >
                      {isActive ? "Active" : "Apply"}
                    </Button>
                  </Card>
                );
              })}
            </div>
          ) : null}

          {activeSection === "api-keys" ? (
            <Card className="border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-5">
                  <div>
                    <label
                      className="text-sm font-semibold text-slate-900"
                      htmlFor="openai-api-key"
                    >
                      OpenAI API Key
                    </label>
                    <p className="mt-1 text-sm text-slate-500">
                      Pour les modèles branchés sur l’API OpenAI.
                    </p>
                    <Input
                      autoComplete="off"
                      className="mt-3"
                      id="openai-api-key"
                      onChange={(event) =>
                        setApiKeys((current) => ({
                          ...current,
                          openai: event.target.value,
                        }))
                      }
                      placeholder="sk-..."
                      type="password"
                      value={apiKeys.openai}
                    />
                  </div>

                  <div>
                    <label
                      className="text-sm font-semibold text-slate-900"
                      htmlFor="anthropic-api-key"
                    >
                      Anthropic API Key
                    </label>
                    <p className="mt-1 text-sm text-slate-500">
                      Pour Claude et les intégrations compatibles.
                    </p>
                    <Input
                      autoComplete="off"
                      className="mt-3"
                      id="anthropic-api-key"
                      onChange={(event) =>
                        setApiKeys((current) => ({
                          ...current,
                          anthropic: event.target.value,
                        }))
                      }
                      placeholder="sk-ant-..."
                      type="password"
                      value={apiKeys.anthropic}
                    />
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label
                      className="text-sm font-semibold text-slate-900"
                      htmlFor="openrouter-api-key"
                    >
                      OpenRouter API Key
                    </label>
                    <p className="mt-1 text-sm text-slate-500">
                      Utile si tu routes plusieurs providers via OpenRouter.
                    </p>
                    <Input
                      autoComplete="off"
                      className="mt-3"
                      id="openrouter-api-key"
                      onChange={(event) =>
                        setApiKeys((current) => ({
                          ...current,
                          openrouter: event.target.value,
                        }))
                      }
                      placeholder="sk-or-..."
                      type="password"
                      value={apiKeys.openrouter}
                    />
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-slate-900">
                      <LockKeyhole className="h-4 w-4" />
                      <p className="text-sm font-semibold">Local-only storage</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Cette première version stocke les clés dans
                      `localStorage`. C’est pratique pour préparer le wiring UI,
                      mais ce n’est pas encore un coffre-fort applicatif.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button onClick={handleSaveApiKeys}>Save API keys</Button>
                {saveMessage ? (
                  <p className="text-sm text-slate-500">{saveMessage}</p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {activeSection === "language" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="grid gap-4 md:grid-cols-2">
                {languageOptions.map((option) => {
                  const isActive = option.id === selectedLanguage;

                  return (
                    <Card
                      key={option.id}
                      className={cn(
                        "overflow-hidden border p-5 transition",
                        isActive
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.95)]"
                          : "border-white/80 bg-white/85 hover:-translate-y-0.5 hover:border-slate-300",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-2xl",
                              isActive ? "bg-white/12" : "bg-slate-100 text-slate-700",
                            )}
                          >
                            <Globe className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-lg font-semibold">{option.nativeLabel}</p>
                            <p
                              className={cn(
                                "text-sm",
                                isActive ? "text-slate-300" : "text-slate-500",
                              )}
                            >
                              {option.label}
                            </p>
                          </div>
                        </div>
                        {isActive ? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12">
                            <Check className="h-4 w-4" />
                          </span>
                        ) : null}
                      </div>

                      <p
                        className={cn(
                          "mt-4 text-sm leading-6",
                          isActive ? "text-slate-300" : "text-slate-600",
                        )}
                      >
                        {option.description}
                      </p>

                      <div className="mt-4 inline-flex rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {option.badge}
                      </div>

                      <Button
                        className="mt-5 w-full"
                        onClick={() => setSelectedLanguage(option.id)}
                        variant={isActive ? "secondary" : "primary"}
                      >
                        {isActive ? "Selected in UI" : "Select"}
                      </Button>
                    </Card>
                  );
                })}
              </div>

              <Card className="border-white/80 bg-white/85 p-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
                <div className="flex items-center gap-2 text-slate-900">
                  <Languages className="h-4 w-4" />
                  <p className="text-sm font-semibold">Preview state</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Cette version ne change pas encore les textes de l’application.
                  Elle sert uniquement a poser l’UI et le futur emplacement du
                  parametre de langue.
                </p>

                <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Current mock selection
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">
                    {selectedLanguage === "fr" ? "Français" : "English"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Aucun wiring i18n n’est branche pour le moment.
                  </p>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
