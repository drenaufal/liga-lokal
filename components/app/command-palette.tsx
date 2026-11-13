"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, CornerDownLeft, ArrowRight } from "lucide-react";
import { navFor } from "@/lib/nav";
import { can, type Capability, type Role } from "@/lib/auth/rbac";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";

type Result = { type: string; label: string; sub?: string; href: string; icon?: string };

const QUICK_ACTIONS: { label: string; href: string; icon: string; cap: Capability }[] = [
  { label: msg("Registrasi pemain baru"), href: "/registry/pemain/baru", icon: "Users", cap: "registry.player:create" },
  { label: msg("Buat turnamen baru"), href: "/kompetisi/baru", icon: "Trophy", cap: "competition:create" },
  { label: msg("Impor data massal (CSV)"), href: "/ingestion", icon: "FileInput", cap: "ingestion:upload" },
  { label: msg("Buka AI Scout"), href: "/ai-scout", icon: "Sparkles", cap: "scout:view" },
];

export function CommandPalette({ role, grants }: { role: Role; grants: readonly Capability[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [remote, setRemote] = React.useState<Result[]>([]);
  const [active, setActive] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setRemote([]);
      setActive(0);
    }
  }, [open]);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setRemote([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setRemote(data.results ?? []);
      } catch {
        /* aborted */
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const navItems: Result[] = navFor({ role, grants })
    .flatMap((n) => [
      { type: t("Modul::jenis"), label: t.dyn(n.label), sub: t.dyn(n.hint), href: n.href, icon: n.icon },
      ...(n.children ?? []).map((c) => ({
        type: t.dyn(n.label),
        label: t.dyn(c.label),
        href: c.href,
        icon: n.icon,
      })),
    ]);

  const actions: Result[] = QUICK_ACTIONS.filter(
    (a) => can({ role, grants }, a.cap),
  ).map((a) => ({ type: t("Tindakan"), label: t.dyn(a.label), href: a.href, icon: a.icon }));

  const q = query.trim().toLowerCase();
  const filteredNav = q
    ? [...actions, ...navItems].filter((i) => i.label.toLowerCase().includes(q))
    : [...actions, ...navItems].slice(0, 8);

  const all = [...filteredNav, ...remote];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!mounted) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("Cari atau lompat ke…")}
        className="flex size-10 items-center justify-center gap-2 rounded-full bg-surface-2 text-sm text-ink-muted transition-colors hover:bg-elevated hover:text-ink-secondary sm:w-64 sm:justify-start sm:px-4 xl:w-72"
      >
        <Search className="size-4 shrink-0 sm:size-3.5" />
        <span className="hidden flex-1 truncate text-left sm:inline">{t("Cari atau lompat ke…")}</span>
        <kbd className="hidden rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-secondary sm:inline">
          ⌘K
        </kbd>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-start justify-center p-3 pt-[8vh] sm:p-4 sm:pt-[12vh]">
            <div
              className="fixed inset-0 bg-night/50 backdrop-blur-[2px] animate-fade-in"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl bg-surface shadow-[0_30px_80px_-20px_rgba(20,20,20,0.45)] animate-pop-in">
              <div className="flex items-center gap-2.5 border-b border-line-soft px-5">
                <Search className="size-4 shrink-0 text-ink-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((a) => Math.min(all.length - 1, a + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((a) => Math.max(0, a - 1));
                    } else if (e.key === "Enter" && all[active]) {
                      go(all[active].href);
                    }
                  }}
                  placeholder={t("Cari pemain, klub, turnamen, atau modul…")}
                  className="h-14 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
              <div className="max-h-[52vh] overflow-y-auto p-2">
                {all.length === 0 && (
                  <p className="px-3 py-8 text-center text-xs text-ink-muted">
                    {query.length >= 2 ? t("Tidak ada hasil.") : t("Ketik untuk mencari…")}
                  </p>
                )}
                {all.map((r, i) => (
                  <button
                    key={r.href + i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      i === active ? "bg-surface-2" : "",
                    )}
                  >
                    {r.icon ? (
                      <Icon name={r.icon} className="size-4 shrink-0 text-ink-muted" />
                    ) : (
                      <ArrowRight className="size-4 shrink-0 text-ink-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{r.label}</span>
                      {r.sub && (
                        <span className="block truncate text-[11px] text-ink-muted">
                          {r.sub}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted ring-1 ring-line">
                      {r.type}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 border-t border-line-soft bg-surface-2 px-5 py-2.5 text-[10px] text-ink-muted">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-line px-1">↑↓</kbd> {t("navigasi")}
                </span>
                <span className="flex items-center gap-1">
                  <CornerDownLeft className="size-3" /> {t("buka")}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-line px-1">esc</kbd> {t("tutup")}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
