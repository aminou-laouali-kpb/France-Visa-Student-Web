import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "@/locales/fr.json";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";
import pt from "@/locales/pt.json";

export const SUPPORTED_LANGUAGES = ["fr", "en", "ar", "pt"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES = new Set(["ar"]);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "fr",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ar: { translation: ar },
      pt: { translation: pt },
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "visaflow.lang",
      caches: ["localStorage"],
    },
  })
  .then(() => applyDir(i18n.language));

i18n.on("languageChanged", (lng) => applyDir(lng));

function applyDir(lng: string) {
  const code = lng.split("-")[0];
  const dir = RTL_LANGUAGES.has(code) ? "rtl" : "ltr";
  if (typeof document !== "undefined") {
    document.documentElement.dir = dir;
    document.documentElement.lang = code;
  }
}

export default i18n;
