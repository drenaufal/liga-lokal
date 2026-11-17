/**
 * Supported UI languages. Indonesian is the source language: every message in the code base is
 * written in Indonesian and doubles as its own id, English lives in `lib/i18n/messages`.
 * The chosen language is kept in a cookie, so routes (`/kompetisi`, `/pengaturan` …) stay the same.
 */
export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "id";
export const LOCALE_COOKIE = "footgrit-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Name of each language, written in that language. */
export const LOCALE_NAME: Record<Locale, string> = {
  id: "Bahasa Indonesia",
  en: "English",
};

/** Two-letter label for the compact switcher. */
export const LOCALE_SHORT: Record<Locale, string> = { id: "ID", en: "EN" };

/** BCP 47 tag handed to `Intl` for dates and numbers. */
export const INTL_LOCALE: Record<Locale, string> = { id: "id-ID", en: "en-GB" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks a supported language from an `Accept-Language` header (highest `q` first). A visitor who
 * asked for neither Indonesian nor English gets the default.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], weight: Number.isNaN(weight) ? 0 : weight, index };
    })
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { lang } of ranked) {
    if (isLocale(lang)) return lang;
    // "in" is the legacy ISO 639 code for Indonesian that some browsers still send.
    if (lang === "in") return "id";
  }
  return DEFAULT_LOCALE;
}
