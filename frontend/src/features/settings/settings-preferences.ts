export type SettingsSection = "theme" | "api-keys" | "language";

export type AppTheme = "warm" | "light" | "night";

export type ApiKeyPreferences = {
  openai: string;
  anthropic: string;
  openrouter: string;
};

const THEME_STORAGE_KEY = "benchforge.theme";
const API_KEYS_STORAGE_KEY = "benchforge.apiKeys";

const DEFAULT_THEME: AppTheme = "warm";

const DEFAULT_API_KEYS: ApiKeyPreferences = {
  openai: "",
  anthropic: "",
  openrouter: "",
};

const appThemes = new Set<AppTheme>(["warm", "light", "night"]);

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export function getStoredTheme(): AppTheme {
  if (!canUseBrowserStorage()) {
    return DEFAULT_THEME;
  }

  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw && appThemes.has(raw as AppTheme)) {
    return raw as AppTheme;
  }

  return DEFAULT_THEME;
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: AppTheme) {
  applyTheme(theme);

  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function readApiKeyPreferences(): ApiKeyPreferences {
  if (!canUseBrowserStorage()) {
    return DEFAULT_API_KEYS;
  }

  const raw = window.localStorage.getItem(API_KEYS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_API_KEYS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ApiKeyPreferences>;
    return {
      openai: parsed.openai ?? "",
      anthropic: parsed.anthropic ?? "",
      openrouter: parsed.openrouter ?? "",
    };
  } catch {
    return DEFAULT_API_KEYS;
  }
}

export function persistApiKeyPreferences(preferences: ApiKeyPreferences) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(
    API_KEYS_STORAGE_KEY,
    JSON.stringify(preferences),
  );
}
