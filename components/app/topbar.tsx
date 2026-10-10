"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";
import { ShortcutsButton } from "./shortcuts";
import { findNavByPath } from "@/lib/nav";
import { BRAND } from "@/lib/brand";
import { LogoChip } from "@/components/brand/logo";
import type { Role } from "@/lib/auth/rbac";

/** Floating glass bar. On phones it carries the logo; the sidebar does from lg up. */
export function Topbar({
  user,
  activeFormula,
}: {
  user: { name: string; email: string; image?: string | null; role: Role; title?: string | null };
  activeFormula: string | null;
}) {
  const pathname = usePathname();
  const nav = findNavByPath(pathname);

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 lg:pl-4 lg:pr-6">
      <div className="flex h-14 items-center gap-2 rounded-full bg-surface/80 pl-3 pr-1.5 shadow-[0_12px_32px_-20px_rgba(20,20,20,0.55)] ring-1 ring-line/70 backdrop-blur-xl sm:pl-4">
        <Link href="/command-center" aria-label={BRAND.name} className="shrink-0 lg:hidden">
          <LogoChip logoClassName="h-9" />
        </Link>

        <div className="hidden min-w-0 shrink-0 items-center gap-1.5 text-xs text-ink-muted xl:flex">
          <span className="font-semibold italic text-brand">{BRAND.name}</span>
          {nav && (
            <>
              <span>/</span>
              <span className="font-semibold text-ink">{nav.label}</span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0 lg:flex-1 lg:justify-between xl:ml-4">
          <CommandPalette role={user.role} />

          <div className="flex items-center gap-1.5">
            {activeFormula && (
              <Link
                href="/player-intelligence/formula"
                className="hidden items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-ink-secondary transition-colors hover:bg-elevated hover:text-ink lg:flex"
                title="Formula penilaian aktif"
              >
                <Gauge className="size-3.5 text-brand" />
                <span className="max-w-[160px] truncate">{activeFormula}</span>
              </Link>
            )}
            <span className="hidden shrink-0 items-center whitespace-nowrap rounded-full bg-block-yellow px-2.5 py-1 text-[10px] font-bold tracking-wide text-ink xl:flex">
              DEMO
            </span>
            <span className="hidden lg:block">
              <ShortcutsButton />
            </span>
            <UserMenu {...user} />
          </div>
        </div>
      </div>
    </header>
  );
}
