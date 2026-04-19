export type SettingsSection = "theme" | "api-keys" | "language";

export type AppTheme =
  | "light"
  | "night"
  | "noir"
  | "sand"
  | "forest"
  | "ocean";

const THEME_STORAGE_KEY = "benchforge.theme";

const DEFAULT_THEME: AppTheme = "light";

const appThemes = new Set<AppTheme>([
  "light",
  "night",
  "noir",
  "sand",
  "forest",
  "ocean",
]);

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export function getStoredTheme(): AppTheme {
  if (!canUseBrowserStorage()) {
    return DEFAULT_THEME;
  }

  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "warm") {
    return "light";
  }
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
