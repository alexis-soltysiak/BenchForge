import {
  Check,
  Globe,
  KeyRound,
  Languages,
  LockKeyhole,
  MoonStar,
  Palette,
  Plus,
  SunMedium,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { queryClient } from "@/lib/query-client";
import {
  type AppTheme,
  type SettingsSection,
  applyTheme,
  persistTheme,
} from "@/features/settings/settings-preferences";
import {
  createApiKeyPreset,
  deleteApiKeyPreset,
  fetchApiKeyPresets,
  updateApiKeyPreset,
} from "@/features/settings/api-keys-api";
import type {
  ApiKeyPreset,
  ApiKeyPresetPayload,
} from "@/features/settings/api-keys-types";
import { ApiError } from "@/lib/api";
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
    id: "light",
    name: "Paper White",
    description: "La base claire et nette, proche de l’interface actuelle.",
    icon: SunMedium,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(255,255,255,1),_rgba(239,246,255,1))]",
  },
  {
    id: "night",
    name: "Night Slate",
    description: "Bleu nuit dense pour les longues sessions et les écrans sombres.",
    icon: MoonStar,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,1))]",
  },
  {
    id: "noir",
    name: "Carbon Noir",
    description: "Un sombre plus chaud, plus contrasté, presque editorial.",
    icon: MoonStar,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(18,18,20,1),_rgba(34,28,26,1))]",
  },
  {
    id: "sand",
    name: "Dune Sand",
    description: "Palette sable, solaire et mate, moins clinique que le blanc pur.",
    icon: Palette,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(250,246,236,1),_rgba(244,232,209,1))]",
  },
  {
    id: "forest",
    name: "Canopy Forest",
    description: "Verts doux et profonds, plus organiques sans virer fantasy.",
    icon: Palette,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(239,248,242,1),_rgba(220,239,228,1))]",
  },
  {
    id: "ocean",
    name: "Tidal Ocean",
    description: "Bleus aqua et surfaces fraîches, plus calmes et plus fluides.",
    icon: Globe,
    previewClassName:
      "bg-[linear-gradient(135deg,_rgba(239,252,255,1),_rgba(218,243,249,1))]",
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

const apiKeyProviderSuggestions = [
  "openai",
  "anthropic",
  "openrouter",
  "ovh",
  "google",
  "mistral",
  "groq",
  "deepseek",
  "huggingface",
  "ollama",
] as const;

type ApiKeyPresetDraft = {
  name: string;
  providerType: string;
  secret: string;
};

const emptyApiKeyPresetDraft: ApiKeyPresetDraft = {
  name: "",
  providerType: "openai",
  secret: "",
};

export function SettingsPage({
  activeSection,
  currentTheme,
  onThemeChange,
  onNavigateToSection,
}: SettingsPageProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<"fr" | "en">("fr");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [newPreset, setNewPreset] = useState<ApiKeyPresetDraft>(emptyApiKeyPresetDraft);
  const [presetDrafts, setPresetDrafts] = useState<Record<number, ApiKeyPresetDraft>>({});

  const apiKeyPresetsQuery = useQuery({
    queryKey: ["api-key-presets"],
    queryFn: fetchApiKeyPresets,
  });

  const activeSectionMeta = useMemo(
    () => settingsSections.find((section) => section.id === activeSection),
    [activeSection],
  );

  const handleThemeSelect = (theme: AppTheme) => {
    persistTheme(theme);
    applyTheme(theme);
    onThemeChange(theme);
  };

  useEffect(() => {
    const presets = apiKeyPresetsQuery.data?.items ?? [];
    setPresetDrafts((current) => {
      const next: Record<number, ApiKeyPresetDraft> = {};
      presets.forEach((preset) => {
        const existing = current[preset.id];
        next[preset.id] = {
          name: existing?.name ?? preset.name,
          providerType: existing?.providerType ?? preset.provider_type,
          secret: existing?.secret ?? "",
        };
      });
      return next;
    });
  }, [apiKeyPresetsQuery.data]);

  const createPresetMutation = useMutation({
    mutationFn: createApiKeyPreset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-key-presets"] });
      setNewPreset(emptyApiKeyPresetDraft);
      setSaveMessage("API key preset created.");
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof ApiError ? error.message : "Unable to create API key preset.",
      );
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: ({ presetId, payload }: { presetId: number; payload: ApiKeyPresetPayload }) =>
      updateApiKeyPreset(presetId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-key-presets"] });
      setSaveMessage("API key preset updated.");
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof ApiError ? error.message : "Unable to update API key preset.",
      );
    },
  });

  const deletePresetMutation = useMutation({
    mutationFn: deleteApiKeyPreset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-key-presets"] });
      setSaveMessage("API key preset deleted.");
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof ApiError ? error.message : "Unable to delete API key preset.",
      );
    },
  });

  const handleCreatePreset = async () => {
    setSaveMessage(null);
    await createPresetMutation.mutateAsync({
      name: newPreset.name.trim(),
      provider_type: newPreset.providerType.trim(),
      secret: newPreset.secret.trim(),
    });
  };

  const handleUpdatePreset = async (preset: ApiKeyPreset) => {
    const draft = presetDrafts[preset.id];
    if (!draft) {
      return;
    }

    setSaveMessage(null);
    await updatePresetMutation.mutateAsync({
      presetId: preset.id,
      payload: {
        name: draft.name.trim(),
        provider_type: draft.providerType.trim(),
        ...(draft.secret.trim() ? { secret: draft.secret.trim() } : {}),
      },
    });
    setPresetDrafts((current) => ({
      ...current,
      [preset.id]: {
        ...current[preset.id],
        secret: "",
      },
    }));
  };

  return (
    <div className="w-full px-3 pt-4 lg:px-6 xl:pr-5">
      <div className="grid gap-4 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        <Card className="h-fit border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-3 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.18)] sm:p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--foreground-soft))]">
            Settings
          </p>
          <h1 className="mt-1.5 font-display text-[1.65rem] font-semibold tracking-tight text-foreground">
            Workspace preferences
          </h1>
          <div className="mt-3 space-y-2">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;

              return (
                <button
                  key={section.id}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[1rem] border px-3 py-2 text-left transition",
                    isActive
                      ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.32)]"
                      : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
                  )}
                  onClick={() => onNavigateToSection(section.id)}
                  type="button"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem]",
                      isActive ? "bg-white/12" : "bg-[hsl(var(--muted))]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                      <span className="block text-[0.84rem] font-semibold">
                      {section.title}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[10px] leading-4",
                        isActive ? "text-[hsl(var(--surface-strong-foreground)/0.76)]" : "text-[hsl(var(--foreground-soft))]",
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

        <div className="space-y-4">
          <Card className="relative overflow-hidden border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-4 shadow-[0_32px_90px_-55px_rgba(15,23,42,0.2)]">
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.14),_transparent_60%)]" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--foreground-soft))]">
                {activeSectionMeta?.title ?? "Settings"}
              </p>
              <h2 className="mt-2 font-display text-[2rem] font-semibold tracking-tight text-foreground">
                {activeSection === "theme"
                  ? "Theme page"
                  : activeSection === "api-keys"
                    ? "API Key page"
                    : "Language page"}
              </h2>
              <p className="mt-2 max-w-2xl text-[0.92rem] leading-6 text-[hsl(var(--foreground-soft))]">
                {activeSection === "theme"
                  ? "Chaque sélection applique immédiatement une ambiance globale à BenchForge."
                  : activeSection === "api-keys"
                    ? "Crée des presets réutilisables par provider, puis sélectionne-les dans la création ou l’édition de modèles."
                    : "UI only pour l’instant. Cette page prépare le futur choix de langue sans brancher encore la traduction réelle."}
              </p>
            </div>
          </Card>

          {activeSection === "theme" ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = option.id === currentTheme;

                return (
                  <Card
                    key={option.id}
                    className={cn(
                      "overflow-hidden border p-3.5 transition",
                      isActive
                        ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.32)]"
                        : "border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.45)]",
                    )}
                  >
                    <div
                      className={cn(
                        "h-24 rounded-[1.1rem] border",
                        isActive ? "border-white/10" : "border-border",
                        option.previewClassName,
                      )}
                    />
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <p className="text-[0.92rem] font-semibold">{option.name}</p>
                        </div>
                        <p
                          className={cn(
                            "mt-1.5 text-[0.86rem] leading-5",
                            isActive
                              ? "text-[hsl(var(--surface-strong-foreground)/0.76)]"
                              : "text-[hsl(var(--foreground-soft))]",
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
                      className="mt-3 w-full h-10 text-[0.92rem]"
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
            <div className="space-y-4">
              <Card className="border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.18)]">
                <div className="flex items-center gap-2 text-foreground">
                  <Plus className="h-4 w-4" />
                  <p className="text-[0.92rem] font-semibold">Add API key preset</p>
                </div>
                <p className="mt-2 text-[0.86rem] leading-5 text-[hsl(var(--foreground-soft))]">
                  Donne un nom, choisis un provider, puis colle la clé. Ce preset
                  pourra ensuite être réutilisé depuis la page Models.
                </p>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_auto]">
                  <Input
                    autoComplete="off"
                    className="h-10 text-[0.92rem]"
                    placeholder="Ex: OpenAI prod"
                    value={newPreset.name}
                    onChange={(event) =>
                      setNewPreset((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                  <Input
                    autoComplete="off"
                    className="h-10 text-[0.92rem]"
                    list="api-key-provider-options"
                    placeholder="openai"
                    value={newPreset.providerType}
                    onChange={(event) =>
                      setNewPreset((current) => ({
                        ...current,
                        providerType: event.target.value,
                      }))
                    }
                  />
                  <Input
                    autoComplete="off"
                    className="h-10 text-[0.92rem]"
                    placeholder="sk-..."
                    type="password"
                    value={newPreset.secret}
                    onChange={(event) =>
                      setNewPreset((current) => ({
                        ...current,
                        secret: event.target.value,
                      }))
                    }
                  />
                  <Button
                    className="h-10 text-[0.92rem]"
                    disabled={
                      createPresetMutation.isPending ||
                      !newPreset.name.trim() ||
                      !newPreset.providerType.trim() ||
                      !newPreset.secret.trim()
                    }
                    onClick={() => void handleCreatePreset()}
                    type="button"
                  >
                    Add line
                  </Button>
                </div>
              </Card>

              <Card className="border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.18)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.92rem] font-semibold text-foreground">
                      Registered presets
                    </p>
                    <p className="mt-1 text-[0.86rem] text-[hsl(var(--foreground-soft))]">
                      Chaque modèle pourra soit utiliser une clé manuelle, soit un preset.
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-border bg-[hsl(var(--surface-muted))] p-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <LockKeyhole className="h-4 w-4" />
                      <p className="text-[0.88rem] font-semibold">Encrypted in backend</p>
                    </div>
                  </div>
                </div>

                {apiKeyPresetsQuery.error instanceof ApiError ? (
                  <div className="mt-4">
                    <LoadErrorState
                      compact
                      message={apiKeyPresetsQuery.error.message}
                      onRetry={() => void apiKeyPresetsQuery.refetch()}
                      resourceLabel="API key presets"
                    />
                  </div>
                ) : apiKeyPresetsQuery.data?.items.length ? (
                  <div className="mt-4 space-y-3">
                    {apiKeyPresetsQuery.data.items.map((preset) => {
                      const draft = presetDrafts[preset.id] ?? {
                        name: preset.name,
                        providerType: preset.provider_type,
                        secret: "",
                      };

                      return (
                        <div
                          key={preset.id}
                          className="grid gap-3 rounded-[1.2rem] border border-border bg-[hsl(var(--surface-muted))] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_auto_auto]"
                        >
                          <Input
                            className="h-10 text-[0.92rem]"
                            value={draft.name}
                            onChange={(event) =>
                              setPresetDrafts((current) => ({
                                ...current,
                                [preset.id]: {
                                  ...draft,
                                  name: event.target.value,
                                },
                              }))
                            }
                          />
                          <Input
                            className="h-10 text-[0.92rem]"
                            list="api-key-provider-options"
                            value={draft.providerType}
                            onChange={(event) =>
                              setPresetDrafts((current) => ({
                                ...current,
                                [preset.id]: {
                                  ...draft,
                                  providerType: event.target.value,
                                },
                              }))
                            }
                          />
                          <Input
                            autoComplete="off"
                            className="h-10 text-[0.92rem]"
                            disabled={preset.has_secret}
                            placeholder={
                              preset.has_secret
                                ? `Stored key: ${preset.secret_preview ?? "******"}`
                                : "Paste a new API key"
                            }
                            type="password"
                            value={draft.secret}
                            onChange={(event) =>
                              setPresetDrafts((current) => ({
                                ...current,
                                [preset.id]: {
                                  ...draft,
                                  secret: event.target.value,
                                },
                              }))
                            }
                          />
                          <Button
                            className="h-10 text-[0.92rem]"
                            disabled={
                              updatePresetMutation.isPending ||
                              !draft.name.trim() ||
                              !draft.providerType.trim()
                            }
                            onClick={() => void handleUpdatePreset(preset)}
                            type="button"
                            variant="secondary"
                          >
                            Save
                          </Button>
                          <Button
                            aria-label={`Delete ${preset.name}`}
                            className="h-10 w-10"
                            disabled={deletePresetMutation.isPending}
                            onClick={() => void deletePresetMutation.mutateAsync(preset.id)}
                            size="icon"
                            title={`Delete ${preset.name}`}
                            type="button"
                            variant="dangerSoft"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-muted))] px-4 py-6 text-sm text-[hsl(var(--foreground-soft))]">
                    No API key preset yet. Add the first line above.
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {saveMessage ? (
                    <p className="text-[0.86rem] text-[hsl(var(--foreground-soft))]">{saveMessage}</p>
                  ) : null}
                </div>
                <datalist id="api-key-provider-options">
                  {apiKeyProviderSuggestions.map((provider) => (
                    <option key={provider} value={provider} />
                  ))}
                </datalist>
              </Card>
            </div>
          ) : null}

          {activeSection === "language" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="grid gap-3 md:grid-cols-2">
                {languageOptions.map((option) => {
                  const isActive = option.id === selectedLanguage;

                  return (
                    <Card
                      key={option.id}
                      className={cn(
                        "overflow-hidden border p-4 transition",
                        isActive
                          ? "border-[hsl(var(--surface-strong))] bg-[hsl(var(--surface-strong))] text-[hsl(var(--surface-strong-foreground))] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.32)]"
                          : "border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.45)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-[1rem]",
                              isActive
                                ? "bg-white/12"
                                : "bg-[hsl(var(--muted))] text-foreground",
                            )}
                          >
                            <Globe className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-[1rem] font-semibold">{option.nativeLabel}</p>
                            <p
                              className={cn(
                                "text-[0.86rem]",
                                isActive
                                  ? "text-[hsl(var(--surface-strong-foreground)/0.76)]"
                                  : "text-[hsl(var(--foreground-soft))]",
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
                          "mt-3 text-[0.86rem] leading-5",
                          isActive
                            ? "text-[hsl(var(--surface-strong-foreground)/0.76)]"
                            : "text-[hsl(var(--foreground-soft))]",
                        )}
                      >
                        {option.description}
                      </p>

                      <div className="mt-3 inline-flex rounded-full border border-border bg-[hsl(var(--surface))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--foreground-soft))]">
                        {option.badge}
                      </div>

                      <Button
                        className="mt-4 h-10 w-full text-[0.92rem]"
                        onClick={() => setSelectedLanguage(option.id)}
                        variant={isActive ? "secondary" : "primary"}
                      >
                        {isActive ? "Selected in UI" : "Select"}
                      </Button>
                    </Card>
                  );
                })}
              </div>

              <Card className="border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-overlay))] p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.18)]">
                <div className="flex items-center gap-2 text-foreground">
                  <Languages className="h-4 w-4" />
                  <p className="text-[0.92rem] font-semibold">Preview state</p>
                </div>
                <p className="mt-2.5 text-[0.86rem] leading-5 text-[hsl(var(--foreground-soft))]">
                  Cette version ne change pas encore les textes de l’application.
                  Elle sert uniquement a poser l’UI et le futur emplacement du
                  parametre de langue.
                </p>

                <div className="mt-4 rounded-[1.2rem] border border-border bg-[hsl(var(--surface-muted))] p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--foreground-soft))]">
                    Current mock selection
                  </p>
                  <p className="mt-2 text-[1.5rem] font-semibold text-foreground">
                    {selectedLanguage === "fr" ? "Français" : "English"}
                  </p>
                  <p className="mt-1.5 text-[0.86rem] text-[hsl(var(--foreground-soft))]">
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
