"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { LogoChip } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type LandingLink = { href: `#${string}`; label: string };

/**
 * Floating pill navigation for the landing page: detached from the top edge,
 * firms up once the page scrolls, highlights the section in view, and folds
 * into a dropdown on small screens.
 */
export function LandingNav({ links }: { links: LandingLink[] }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);

  // Scroll state + the section whose top has passed 40% of the viewport.
  React.useEffect(() => {
    const ids = links.map((l) => l.href.slice(1));
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
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="relative mx-auto max-w-6xl">
        <div
          className={cn(
            "flex h-16 items-center justify-between gap-3 rounded-full pl-4 pr-2 ring-1 backdrop-blur-xl transition-all duration-300 sm:pl-5",
            scrolled || open
              ? "bg-surface/90 shadow-[0_16px_40px_-20px_rgba(20,20,20,0.45)] ring-line/80"
              : "bg-surface/60 ring-white/60",
          )}
        >
          <Link href="/" aria-label={BRAND.name} className="shrink-0">
            <LogoChip logoClassName="h-10" />
          </Link>

          <nav aria-label="Bagian halaman" className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const on = active === l.href.slice(1);
              return (
                <a
                  key={l.href}
                  href={l.href}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                    on ? "bg-night text-white" : "text-ink-secondary hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {l.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-xs font-semibold text-white shadow-[0_10px_24px_-12px_rgba(228,34,45,0.9)] transition-colors hover:bg-brand-dark"
            >
              Masuk <ArrowRight className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? "Tutup menu" : "Buka menu"}
              className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-elevated md:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="absolute inset-x-0 top-full mt-2 rounded-[1.75rem] bg-surface p-2 shadow-[0_24px_60px_-20px_rgba(20,20,20,0.5)] ring-1 ring-line/80 animate-slide-down md:hidden">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-semibold text-ink hover:bg-surface-2"
              >
                {l.label}
                <ArrowRight className="size-4 text-ink-muted" />
              </a>
            ))}
            <Link
              href="/login"
              className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-night px-4 py-3.5 text-sm font-semibold text-white"
            >
              Jelajahi demo platform <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
