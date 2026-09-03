"use client";

import { useAuth } from "../auth-context";
import { DICTIONARIES, type Language, type TranslationKey } from "./dictionary";

// Reusa el idioma ya cargado en auth-context (viene de /auth/login y
// /auth/me, ver clients.language) — sin Provider propio ni fetch adicional.
export function useTranslation() {
  const { language } = useAuth();
  const lang: Language = language === "en" ? "en" : "es";

  function t(key: TranslationKey): string {
    return DICTIONARIES[lang][key] ?? DICTIONARIES.es[key] ?? key;
  }

  return { t, language: lang };
}
