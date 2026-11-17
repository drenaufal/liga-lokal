import * as React from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from "./config";
import { makeFormatters } from "./format";
import { en } from "./messages";
import { createT, type TFunction } from "./translate";

// `React.cache` only exists in the server build of React; scripts that import the domain
// libraries outside Next (seeds, tests) just get the function back unwrapped.
const perRequest: <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => R =
  typeof React.cache === "function" ? React.cache : (fn) => fn;

/**
 * The language of the current request: the visitor's saved choice, otherwise whatever their
 * browser prefers (Indonesian or English), otherwise Indonesian.
 * Works in Server Components, Server Actions and Route Handlers.
 */
export const getLocale = perRequest(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return negotiateLocale((await headers()).get("accept-language"));
});

/** `t` (messages), `fmt` (dates, numbers, currency) and `locale` for the current request. */
export const getI18n = perRequest(async () => {
  const locale = await getLocale();
  return {
    locale,
    t: createT(locale, locale === "en" ? en : {}),
    fmt: makeFormatters(locale),
  };
});

export async function getT() {
  return (await getI18n()).t;
}

/**
 * `getT` for domain code that also runs outside a request (CLI seeds, tests): with no request
 * to read a language from it speaks Indonesian instead of throwing.
 */
export async function getSafeT(): Promise<TFunction> {
  try {
    return await getT();
  } catch {
    return createT("id", {});
  }
}

/** `getSafeT` that also hands over the formatters (dates in a message, say). */
export async function getSafeI18n(): Promise<Awaited<ReturnType<typeof getI18n>>> {
  try {
    return await getI18n();
  } catch {
    return { locale: "id", t: createT("id", {}), fmt: makeFormatters("id") };
  }
}
