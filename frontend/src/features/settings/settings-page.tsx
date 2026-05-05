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
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { persistLanguage, getStoredAppLanguage, type AppLanguage } from "@/i18n";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SettingsPageProps, ApiKeyPresetDraft } from "./types";
import { apiKeyProviderSuggestions, emptyApiKeyPresetDraft } from "./constants";

export function SettingsPage({
  activeSection,
  currentTheme,
  onThemeChange,
  onNavigateToSection,
}: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(
    () => getStoredAppLanguage(),
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [newPreset, setNewPreset] = useState<ApiKeyPresetDraft>(emptyApiKeyPresetDraft);
  const [presetDrafts, setPresetDrafts] = useState<Record<number, ApiKeyPresetDraft>>({});

  const settingsSections: Array<{
    id: SettingsSection;
    title: string;
    description: string;
    icon: typeof Palette;
  }> = [
    {
      id: "theme",
      title: t("settings.theme.sidebarTitle"),
      description: t("settings.theme.sidebarDesc"),
      icon: Palette,
    },
    {
      id: "api-keys",
      title: t("settings.apiKeys.sidebarTitle"),
      description: t("settings.apiKeys.sidebarDesc"),
      icon: KeyRound,
    },
    {
      id: "language",
      title: t("settings.language.sidebarTitle"),
      description: t("settings.language.sidebarDesc"),
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
      name: t("theme.paperWhite.name"),
      description: t("theme.paperWhite.description"),
      icon: SunMedium,
      previewClassName:
        "bg-[linear-gradient(135deg,_rgba(255,255,255,1),_rgba(239,246,255,1))]",
    },
    {
      id: "night",
      name: t("theme.nightSlate.name"),
      description: t("theme.nightSlate.description"),
      icon: MoonStar,
      previewClassName:
        "bg-[linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,1))]",
    },
    {
      id: "noir",
      name: t("theme.carbonNoir.name"),
      description: t("theme.carbonNoir.description"),
      icon: MoonStar,
      previewClassName:
        "bg-[linear-gradient(135deg,_rgba(18,18,20,1),_rgba(34,28,26,1))]",
    },
    {
      id: "sand",
      name: t("theme.duneSand.name"),
      description: t("theme.duneSand.description"),
      icon: Palette,
      previewClassName:
        "bg-[linear-gradient(135deg,_rgba(250,246,236,1),_rgba(244,232,209,1))]",
    },
    {
      id: "forest",
      name: t("theme.canopyForest.name"),
      description: t("theme.canopyForest.description"),
      icon: Palette,
      previewClassName:
        "bg-[linear-gradient(135deg,_rgba(239,248,242,1),_rgba(220,239,228,1))]",
    },
    {
      id: "ocean",
      name: t("theme.tidalOcean.name"),
      description: t("theme.tidalOcean.description"),
      icon: Globe,
      previewClassName:
        "bg-[linear-gradient(135deg,_rgba(239,252,255,1),_rgba(218,243,249,1))]",
    },
  ];

  const languageOptions: Array<{
    id: AppLanguage;
    nativeLabel: string;
    label: string;
    description: string;
    badge: string;
  }> = [
    {
      id: "fr",
      nativeLabel: t("language.fr.native"),
      label: t("language.fr.label"),
      description: t("language.fr.description"),
      badge: t("language.fr.badge"),
    },
    {
      id: "en",
      nativeLabel: t("language.en.native"),
      label: t("language.en.label"),
      description: t("language.en.description"),
      badge: t("language.en.badge"),
    },
  ];

  const apiKeyPresetsQuery = useQuery({
    queryKey: ["api-key-presets"],
    queryFn: fetchApiKeyPresets,
  });
  const apiKeyPresetsCount = apiKeyPresetsQuery.data?.items.length ?? 0;

  const activeSectionMeta = useMemo(
    () => settingsSections.find((section) => section.id === activeSection),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSection, i18n.language],
  );

  const handleThemeSelect = (theme: AppTheme) => {
    persistTheme(theme);
    applyTheme(theme);
    onThemeChange(theme);
  };

  const handleLanguageSelect = (lang: AppLanguage) => {
    setSelectedLanguage(lang);
    persistLanguage(lang);
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
      setSaveMessage(t("apiKeys.created"));
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof ApiError ? error.message : t("apiKeys.errorCreate"),
      );
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: ({ presetId, payload }: { presetId: number; payload: ApiKeyPresetPayload }) =>
      updateApiKeyPreset(presetId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-key-presets"] });
      setSaveMessage(t("apiKeys.updated"));
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof ApiError ? error.message : t("apiKeys.errorUpdate"),
      );
    },
  });

  const deletePresetMutation = useMutation({
    mutationFn: deleteApiKeyPreset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-key-presets"] });
      setSaveMessage(t("apiKeys.deleted"));
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof ApiError ? error.message : t("apiKeys.errorDelete"),
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
    <div className="text-foreground">
      <header className="border-b border-border/50 px-6 pb-6 pt-8 lg:px-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.28em] text-primary/80">
              {activeSectionMeta?.title ?? t("settings.title")}
            </p>
            <h1 className="text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
              {activeSection === "theme"
                ? t("settings.theme.pageHeading")
                : activeSection === "api-keys"
                  ? t("settings.apiKeys.pageHeading")
                  : t("settings.language.pageHeading")}
            </h1>
            <p className="mt-3 text-[0.95rem] leading-7 text-muted-foreground">
              {activeSection === "theme"
                ? t("settings.theme.pageDesc")
                : activeSection === "api-keys"
                  ? t("settings.apiKeys.pageDesc")
                  : t("settings.language.pageDesc")}
            </p>
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-2.5 lg:flex">
            <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
              <Palette className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold text-foreground">{themeOptions.length}</span> thèmes
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold text-foreground">{apiKeyPresetsCount}</span> presets API
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
              <Languages className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold text-foreground">{selectedLanguage === "fr" ? "FR" : "EN"}</span> langue active
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-6 py-3 lg:px-8">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeSection;

          return (
            <button
              key={section.id}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-medium transition",
                isActive
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-[hsl(var(--surface))] text-foreground hover:bg-[hsl(var(--surface-muted))]",
              )}
              onClick={() => onNavigateToSection(section.id)}
              type="button"
            >
              <Icon className="h-3.5 w-3.5" />
              {section.title}
            </button>
          );
        })}
      </div>

      {saveMessage ? (
        <div className="border-b border-primary/20 bg-primary/5 px-6 py-2.5 text-[0.82rem] text-primary lg:px-8">
          {saveMessage}
        </div>
      ) : null}

      <div className="px-6 py-6 lg:px-8">
        <div className="space-y-6">
          {activeSection === "theme" ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
                <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                  {themeOptions.find((option) => option.id === currentTheme)?.name ?? currentTheme}
                </Badge>
                <Badge variant="muted" className="whitespace-nowrap text-[0.7rem]">
                  {themeOptions.length} palettes
                </Badge>
                <Badge variant="muted" className="whitespace-nowrap text-[0.7rem]">
                  {currentTheme === "night" || currentTheme === "noir" ? "dark leaning" : "light leaning"}
                </Badge>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = option.id === currentTheme;

                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "overflow-hidden rounded-[1.2rem] border p-3.5 transition",
                        isActive
                          ? "border-primary/30 bg-primary/5 text-foreground"
                          : "border-border/70 bg-[hsl(var(--surface))] hover:border-primary/25 hover:bg-[hsl(var(--surface-overlay))]",
                      )}
                    >
                      <div
                        className={cn(
                          "h-20 rounded-[1rem] border",
                          isActive ? "border-primary/20" : "border-border",
                          option.previewClassName,
                        )}
                      />
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Theme preset
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <p className="text-[0.92rem] font-semibold">{option.name}</p>
                          </div>
                          <p
                            className={cn(
                              "mt-1.5 text-[0.86rem] leading-5",
                              isActive ? "text-foreground/70" : "text-muted-foreground",
                            )}
                          >
                            {option.description}
                          </p>
                        </div>
                        {isActive ? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Check className="h-4 w-4" />
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                        <Badge className="text-[0.68rem]" variant={isActive ? "accent" : "neutral"}>
                          {isActive ? t("theme.active") : "Preset"}
                        </Badge>
                        <Button
                          className="h-8 text-[0.82rem]"
                          onClick={() => handleThemeSelect(option.id)}
                          variant={isActive ? "secondary" : "primary"}
                          size="sm"
                        >
                          {isActive ? t("theme.active") : t("theme.apply")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeSection === "api-keys" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
                <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                  {apiKeyPresetsCount} presets
                </Badge>
                <Badge variant="muted" className="whitespace-nowrap text-[0.7rem]">
                  {apiKeyProviderSuggestions.length} providers suggérés
                </Badge>
                <Badge variant="muted" className="whitespace-nowrap text-[0.7rem]">
                  backend chiffré
                </Badge>
              </div>
              <section className="rounded-[1.2rem] border border-border/70 bg-[hsl(var(--surface))] p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Plus className="h-4 w-4" />
                  <p className="text-[0.92rem] font-semibold">{t("apiKeys.addPreset")}</p>
                </div>
                <p className="mt-2 text-[0.86rem] leading-5 text-[hsl(var(--foreground-soft))]">
                  {t("apiKeys.addPresetDesc")}
                </p>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_auto]">
                  <Input
                    autoComplete="off"
                    className="h-10 text-[0.92rem]"
                    placeholder={t("apiKeys.namePlaceholder")}
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
                    {t("apiKeys.addLine")}
                  </Button>
                </div>
              </section>

              <section className="rounded-[1.2rem] border border-border/70 bg-[hsl(var(--surface))]">
                <div className="flex items-start justify-between gap-3">
                  <div className="px-4 pb-4 pt-4">
                    <p className="text-[0.92rem] font-semibold text-foreground">
                      {t("apiKeys.registeredPresets")}
                    </p>
                    <p className="mt-1 text-[0.86rem] text-[hsl(var(--foreground-soft))]">
                      {t("apiKeys.registeredPresetsDesc")}
                    </p>
                  </div>
                  <div className="m-4 rounded-[1rem] border border-border bg-[hsl(var(--surface-muted))] px-3 py-2.5">
                    <div className="flex items-center gap-2 text-foreground">
                      <LockKeyhole className="h-4 w-4" />
                      <p className="text-[0.82rem] font-semibold">{t("apiKeys.encryptedInBackend")}</p>
                    </div>
                  </div>
                </div>

                {apiKeyPresetsQuery.error instanceof ApiError ? (
                  <div className="border-t border-border/40 px-4 py-4">
                    <LoadErrorState
                      compact
                      message={apiKeyPresetsQuery.error.message}
                      onRetry={() => void apiKeyPresetsQuery.refetch()}
                      resourceLabel="API key presets"
                    />
                  </div>
                ) : apiKeyPresetsQuery.data?.items.length ? (
                  <div className="border-t border-border/40">
                    {apiKeyPresetsQuery.data.items.map((preset) => {
                      const draft = presetDrafts[preset.id] ?? {
                        name: preset.name,
                        providerType: preset.provider_type,
                        secret: "",
                      };

                      return (
                        <div
                          key={preset.id}
                          className="border-b border-border/40 px-4 py-4 last:border-b-0"
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge className="text-[0.68rem]" variant="muted">
                              {draft.providerType || preset.provider_type}
                            </Badge>
                            <Badge className="text-[0.68rem]" variant="neutral">
                              {preset.has_secret ? "Configured" : "No secret"}
                            </Badge>
                          </div>
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_auto_auto]">
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
                                  ? `${t("apiKeys.storedKeyPrefix")} ${preset.secret_preview ?? "******"}`
                                  : t("apiKeys.pasteNewKey")
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
                              {t("apiKeys.save")}
                            </Button>
                            <Button
                              aria-label={`${t("apiKeys.delete")} ${preset.name}`}
                              className="h-10 w-10"
                              disabled={deletePresetMutation.isPending}
                              onClick={() => void deletePresetMutation.mutateAsync(preset.id)}
                              size="icon"
                              title={`${t("apiKeys.delete")} ${preset.name}`}
                              type="button"
                              variant="dangerSoft"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border-t border-dashed border-border/60 px-4 py-8 text-sm text-[hsl(var(--foreground-soft))]">
                    {t("apiKeys.noPresetYet")}
                  </div>
                )}

                <datalist id="api-key-provider-options">
                  {apiKeyProviderSuggestions.map((provider) => (
                    <option key={provider} value={provider} />
                  ))}
                </datalist>
              </section>
            </div>
          ) : null}

          {activeSection === "language" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
                <Badge variant="accent" className="whitespace-nowrap text-[0.7rem]">
                  {selectedLanguage === "fr" ? "Français" : "English"}
                </Badge>
                <Badge variant="muted" className="whitespace-nowrap text-[0.7rem]">
                  {languageOptions.length} options
                </Badge>
                <Badge variant="muted" className="whitespace-nowrap text-[0.7rem]">
                  app-wide
                </Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-3">
                  {languageOptions.map((option) => {
                    const isActive = option.id === selectedLanguage;

                    return (
                      <button
                        key={option.id}
                        className={cn(
                          "flex w-full items-center justify-between gap-4 rounded-[1.15rem] border px-4 py-4 text-left transition",
                          isActive
                            ? "border-primary/30 bg-primary/5"
                            : "border-border/70 bg-[hsl(var(--surface))] hover:border-primary/20 hover:bg-[hsl(var(--surface-overlay))]",
                        )}
                        onClick={() => handleLanguageSelect(option.id)}
                        type="button"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "bg-[hsl(var(--surface-muted))] text-foreground",
                            )}
                          >
                            <Globe className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-[0.98rem] font-semibold text-foreground">
                              {option.nativeLabel}
                            </p>
                            <p className="mt-0.5 text-[0.84rem] text-muted-foreground">
                              {option.label}
                            </p>
                            <p className="mt-1.5 text-[0.82rem] leading-5 text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className="text-[0.68rem]" variant={isActive ? "accent" : "muted"}>
                            {option.badge}
                          </Badge>
                          {isActive ? (
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-[0.76rem] font-semibold text-primary">
                              <Check className="h-3.5 w-3.5" />
                              {t("language.selected")}
                            </span>
                          ) : (
                            <span className="text-[0.76rem] font-medium text-muted-foreground">
                              {t("language.select")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <section className="rounded-[1.2rem] border border-border/70 bg-[hsl(var(--surface))] p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Languages className="h-4 w-4" />
                  <p className="text-[0.92rem] font-semibold">{t("language.previewState")}</p>
                </div>

                <div className="mt-4 rounded-[1rem] border border-border bg-[hsl(var(--surface-muted))] p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--foreground-soft))]">
                    {t("language.currentSelection")}
                  </p>
                  <p className="mt-2 text-[1.5rem] font-semibold text-foreground">
                    {selectedLanguage === "fr" ? "Français" : "English"}
                  </p>
                  <p className="mt-2 text-[0.86rem] leading-6 text-muted-foreground">
                    Les labels du studio, les statuts et les vues principales suivent cette sélection.
                  </p>
                </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
