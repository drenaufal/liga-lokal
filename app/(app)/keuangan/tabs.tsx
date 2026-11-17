"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, Calculator, ClipboardCheck, HandCoins, LayoutDashboard, Landmark, Package, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { msg } from "@/lib/i18n/translate";
import { useT } from "@/lib/i18n/client";

const TABS = [
  { href: "/keuangan", label: msg("Ringkasan"), icon: LayoutDashboard },
  { href: "/keuangan/aset", label: msg("Aset"), icon: Package },
  { href: "/keuangan/modal", label: msg("Modal"), icon: Landmark },
  { href: "/keuangan/dividen", label: msg("Dividen"), icon: HandCoins },
  { href: "/keuangan/registrasi", label: msg("Registrasi"), icon: ClipboardCheck },
  { href: "/keuangan/match-fee", label: msg("Match Fee"), icon: Ticket },
  { href: "/keuangan/rab", label: msg("RAB"), icon: Calculator },
  { href: "/keuangan/unit", label: msg("Unit Bisnis"), icon: Building2 },
];

/** Tab bar of the Keuangan module. The chosen ?unit= filter travels with every tab. */
export function FinanceTabs({ allowed }: { allowed: string[] }) {
  const t = useT();
  const pathname = usePathname();
  const unit = useSearchParams().get("unit");
  return (
    <nav aria-label="Keuangan" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {TABS.filter((tab) => allowed.includes(tab.href)).map((tab) => {
        const active = tab.href === "/keuangan" ? pathname === tab.href : pathname.startsWith(tab.href);
        // the unit page lists every unit, so a single-unit filter has no meaning there
        const href = unit && tab.href !== "/keuangan/unit" ? `${tab.href}?unit=${encodeURIComponent(unit)}` : tab.href;
        return (
          <Link
            key={tab.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink-secondary",
            )}
          >
            <tab.icon className="size-3.5" />
            {t.dyn(tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
