import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en";
import fr from "@/locales/fr";

export type AppLanguage = "fr" | "en";

const LANGUAGE_STORAGE_KEY = "benchforge.language";
const DEFAULT_LANGUAGE: AppLanguage = "fr";

function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (raw === "fr" || raw === "en") {
    return raw;
  }
  return DEFAULT_LANGUAGE;
}

export function persistLanguage(lang: AppLanguage) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }
  void i18n.changeLanguage(lang);
}

export function getStoredAppLanguage(): AppLanguage {
  return getStoredLanguage();
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: getStoredLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
