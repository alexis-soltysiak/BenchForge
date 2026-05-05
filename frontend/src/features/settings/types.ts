import type { AppTheme, SettingsSection } from "./settings-preferences";

export type SettingsPageProps = {
  activeSection: SettingsSection;
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onNavigateToSection: (section: SettingsSection) => void;
};

export type ApiKeyPresetDraft = {
  name: string;
  providerType: string;
  secret: string;
};
