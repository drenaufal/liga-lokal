"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, Radar, Trophy, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { isPageLink, type LandingLink } from "./links";

/**
 * Landing navigation: logo on the left, the section links as separate grey
 * pills (a page link such as the competitions is an accented pill), a red "Masuk"
 * button on the right. Transparent over the hero; once the page scrolls it settles
 * onto a frosted bar. Highlights the section in view and folds into a dropdown on
 * small screens.
 */
export function LandingNav({ links }: { links: LandingLink[] }) {
  const t = useT();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);

  // Scroll state + the section whose top has passed 40% of the viewport.
  React.useEffect(() => {
    const ids = links.filter((l) => !isPageLink(l)).map((l) => l.href.slice(1));
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [links]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="relative mx-auto max-w-[1320px]">
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-full py-1.5 pl-4 pr-2 transition-all duration-300 sm:pl-5",
            scrolled || open
              ? "bg-white/85 shadow-[0_16px_40px_-20px_rgba(20,20,20,0.45)] ring-1 ring-black/5 backdrop-blur-xl"
              : "bg-transparent ring-1 ring-transparent",
          )}
        >
          <Link href="/" aria-label={BRAND.name} className="shrink-0">
            <Image
              src="/landing/logo-dark.png"
              alt={BRAND.name}
              width={BRAND.logoSize.width}
              height={BRAND.logoSize.height}
              unoptimized
              priority
              className="h-12 w-auto select-none sm:h-[60px]"
            />
          </Link>

          <nav aria-label={t("Bagian halaman")} className="hidden items-center gap-4 xl:flex">
            {links.map((l) => {
              if (isPageLink(l)) {
                const PageIcon = l.icon === "radar" ? Radar : Trophy;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand/10 px-5 py-2 text-xs font-semibold text-brand ring-1 ring-brand/25 transition-colors hover:bg-brand hover:text-white"
                  >
                    <PageIcon className="size-3.5" />
                    {t.dyn(l.label)}
                  </Link>
                );
              }
              const on = active === l.href.slice(1);
              return (
                <a
                  key={l.href}
                  href={l.href}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "rounded-full px-5 py-2 text-xs font-medium transition-colors",
                    on ? "bg-night text-white" : "bg-[#dfe0d8] text-ink hover:bg-ink hover:text-white",
                  )}
                >
                  {t.dyn(l.label)}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <LanguageSwitcher tone="glass" className="hidden sm:inline-flex" />
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-brand px-6 text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgba(228,34,45,0.9)] transition-colors hover:bg-brand-dark sm:h-12 sm:px-7"
            >
              {t("Masuk")} <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? t("Tutup menu") : t("Buka menu")}
              className="grid size-11 place-items-center rounded-full bg-[#dfe0d8] text-ink transition-colors hover:bg-elevated xl:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="absolute inset-x-0 top-full mt-2 rounded-[1.75rem] bg-surface p-2 shadow-[0_24px_60px_-20px_rgba(20,20,20,0.5)] ring-1 ring-line/80 animate-slide-down xl:hidden">
            {links.map((l) =>
              isPageLink(l) ? (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="mt-1 flex items-center justify-between rounded-2xl bg-brand/10 px-4 py-3.5 text-sm font-semibold text-brand hover:bg-brand/15"
                >
                  <span className="flex items-center gap-2">
                    {l.icon === "radar" ? <Radar className="size-4" /> : <Trophy className="size-4" />}
                    {t.dyn(l.label)}
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-semibold text-ink hover:bg-surface-2"
                >
                  {t.dyn(l.label)}
                  <ArrowRight className="size-4 text-ink-muted" />
                </a>
              ),
            )}
            <div className="mt-1 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2.5 sm:hidden">
              <span className="text-sm font-semibold text-ink">{t("Bahasa")}</span>
              <LanguageSwitcher tone="light" />
            </div>
            <Link
              href="/login"
              className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-night px-4 py-3.5 text-sm font-semibold text-white"
            >
              {t("Masuk ke platform")} <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
