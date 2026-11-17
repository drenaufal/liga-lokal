"use client";

import { I18nProvider } from "./client";
import { en } from "./messages";

/**
 * Loaded only when the page is rendered in English, so the English catalog stays out of the
 * Indonesian bundle (and out of every `router.refresh()` payload).
 */
export function EnglishProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale="en" messages={en}>
      {children}
    </I18nProvider>
  );
}
