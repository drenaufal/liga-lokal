"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * Tabs of one KU. The group table only exists for a league (or an older cup
 * that still has a group stage); the bracket only for a cup.
 */
export function TournamentTabs({
  id,
  format,
  hasGroups,
}: {
  id: string;
  format: string;
  hasGroups: boolean;
}) {
  const t = useT();
  const pathname = usePathname();
  const base = `/kompetisi/ku/${id}`;

  const tabs = [
    { href: base, label: t("Ringkasan") },
    { href: `${base}/jadwal`, label: t("Jadwal & Hasil") },
    ...(format === "league" || hasGroups ? [{ href: `${base}/klasemen`, label: t("Klasemen") }] : []),
    ...(format === "cup" ? [{ href: `${base}/bagan`, label: t("Bagan Cup") }] : []),
    { href: `${base}/peserta`, label: t("Peserta") },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "border-brand text-ink"
                : "border-transparent text-ink-muted hover:text-ink-secondary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
