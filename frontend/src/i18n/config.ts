import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";

i18next.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
