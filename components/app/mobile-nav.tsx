"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { LayoutGrid, LogOut, X } from "lucide-react";
import { NAV, SETTINGS_NAV, type NavItem } from "@/lib/nav";
import { can, ROLE_LABEL, type Role } from "@/lib/auth/rbac";
import { logoutAction } from "@/app/(app)/actions";
import { Avatar } from "@/components/ui/avatar";
import { LogoChip } from "@/components/brand/logo";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

/** Modules that earn a slot on the bar, in order; the rest live in the menu sheet. */
const PRIMARY = ["command-center", "match-ops", "kompetisi", "registry", "player-intelligence", "ai-scout"];

function isActive(item: NavItem, pathname: string) {
  return (
    pathname === item.href ||
    pathname.startsWith("/" + item.key) ||
    !!item.children?.some((c) => pathname.startsWith(c.href))
  );
}

/**
 * Floating bottom navigation for phones and tablets (< lg), plus a bottom
 * sheet with every module. The desktop sidebar takes over from lg up.
 */
export function MobileNav({
  role,
  user,
}: {
  role: Role;
  user: { name: string; email: string; image?: string | null };
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const items = [...NAV, SETTINGS_NAV].filter((n) => !n.capability || can(role, n.capability));
  const primary = PRIMARY.map((k) => items.find((i) => i.key === k))
    .filter((i): i is NavItem => !!i)
    .slice(0, 4);
  const menuActive = !primary.some((i) => isActive(i, pathname));

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-1 rounded-full bg-night p-1.5 shadow-[0_18px_40px_-12px_rgba(20,20,20,0.65)] ring-1 ring-white/5">
          {primary.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex h-12 min-w-0 items-center justify-center gap-2 rounded-full text-xs font-semibold transition-all",
                  active ? "flex-[2.2] bg-brand px-3 text-white" : "flex-1 text-night-muted hover:text-white",
                )}
              >
                <Icon name={item.icon} className="size-5 shrink-0" />
                {active && <span className="truncate">{item.short}</span>}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Buka semua menu"
            aria-expanded={open}
            className={cn(
              "flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full text-xs font-semibold transition-all",
              menuActive ? "bg-white text-ink" : "text-night-muted hover:text-white",
            )}
          >
            <LayoutGrid className="size-5 shrink-0" />
          </button>
        </div>
      </nav>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-night/50 backdrop-blur-[2px] animate-fade-in" onClick={() => setOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[2rem] bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 animate-sheet-up">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-elevated" />
              <div className="flex items-center justify-between gap-3">
                <LogoChip logoClassName="h-11" />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Tutup menu"
                  className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-secondary hover:bg-elevated"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-night p-3 text-white">
                <Avatar src={user.image} name={user.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-[11px] text-night-muted">
                    {ROLE_LABEL[role]} · {user.email}
                  </p>
                </div>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    aria-label="Keluar"
                    className="grid size-10 place-items-center rounded-full bg-night-2 text-white hover:bg-night-line"
                  >
                    <LogOut className="size-4" />
                  </button>
                </form>
              </div>

              <ul className="mt-4 grid grid-cols-2 gap-2">
                {items.map((item) => {
                  const active = isActive(item, pathname);
                  return (
                    <li key={item.key} className={cn(item.children && "col-span-2")}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-[64px] items-center gap-3 rounded-2xl p-3 transition-colors",
                          active ? "bg-brand text-white" : "bg-surface-2 text-ink hover:bg-elevated",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-full",
                            active ? "bg-white/20" : "bg-surface text-ink-secondary",
                          )}
                        >
                          <Icon name={item.icon} className="size-[18px]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                          <span className={cn("block truncate text-[11px]", active ? "text-white" : "text-ink-muted")}>
                            {item.hint}
                          </span>
                        </span>
                      </Link>
                      {item.children && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
                          {item.children.map((c) => (
                            <Link
                              key={c.href}
                              href={c.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                                pathname === c.href
                                  ? "bg-night text-white"
                                  : "bg-surface-2 text-ink-secondary hover:bg-elevated",
                              )}
                            >
                              {c.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
