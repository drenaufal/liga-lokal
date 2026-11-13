import { getLocale } from "./server";
import { I18nProvider } from "./client";
import { EnglishProvider } from "./provider-en";

const NO_MESSAGES = {} as const;

/** Mount once in the root layout: every Client Component below can call `useT()`. */
export async function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  if (locale === "en") return <EnglishProvider>{children}</EnglishProvider>;
  return (
    <I18nProvider locale="id" messages={NO_MESSAGES}>
      {children}
    </I18nProvider>
  );
}
