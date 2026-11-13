"use client";

import * as React from "react";
import type { Locale } from "./config";
import { makeFormatters, type Formatters } from "./format";
import { createT, type TFunction } from "./translate";

type I18n = { locale: Locale; t: TFunction; fmt: Formatters };

const I18nContext = React.createContext<I18n | null>(null);

/**
 * Hands the language to Client Components. The English catalog is not imported here — see
 * `provider.tsx` — so Indonesian visitors never download it.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Readonly<Record<string, string>>;
  children: React.ReactNode;
}) {
  const value = React.useMemo<I18n>(
    () => ({ locale, t: createT(locale, messages), fmt: makeFormatters(locale) }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = React.useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <LocaleProvider>.");
  return value;
}

/** `t(...)` for a Client Component. */
export function useT() {
  return useI18n().t;
}

export function useLocale() {
  return useI18n().locale;
}
