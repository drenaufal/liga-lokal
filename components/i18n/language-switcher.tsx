"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAME, LOCALE_SHORT, type Locale } from "@/lib/i18n/config";
import { setLocaleAction } from "@/lib/i18n/actions";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const TONE = {
  /** On a light surface. */
  light: { track: "bg-surface-2 ring-1 ring-line/70", idle: "text-ink-muted hover:text-ink", on: "bg-night text-white" },
  /** On a dark (night) surface. */
  dark: { track: "bg-white/10", idle: "text-white/70 hover:text-white", on: "bg-white text-ink" },
  /** On the translucent landing nav. */
  glass: { track: "bg-night/5 ring-1 ring-line/60", idle: "text-ink-secondary hover:text-ink", on: "bg-night text-white" },
} as const;

/**
 * Two-way ID / EN toggle. Saves the choice in a cookie and refreshes the page, so the
 * same URL re-renders in the other language.
 */
export function LanguageSwitcher({
  tone = "light",
  className,
}: {
  tone?: keyof typeof TONE;
  className?: string;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [chosen, setChosen] = React.useState<Locale | null>(null);
  const colours = TONE[tone];
  const current = pending && chosen ? chosen : locale;

  function choose(next: Locale) {
    if (next === locale || pending) return;
    setChosen(next);
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("Bahasa")}
      className={cn("inline-flex shrink-0 items-center rounded-full p-0.5", colours.track, pending && "opacity-70", className)}
    >
      {LOCALES.map((code) => {
        const on = code === current;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={on}
            aria-label={LOCALE_NAME[code]}
            title={LOCALE_NAME[code]}
            onClick={() => choose(code)}
            className={cn(
              "h-7 min-w-9 rounded-full px-2.5 text-[11px] font-bold tracking-wide transition-colors",
              on ? colours.on : colours.idle,
            )}
          >
            {LOCALE_SHORT[code]}
          </button>
        );
      })}
    </div>
  );
}
