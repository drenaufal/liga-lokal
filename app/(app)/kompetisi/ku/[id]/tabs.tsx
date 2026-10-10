"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();
  const base = `/kompetisi/ku/${id}`;

  const tabs = [
    { href: base, label: "Ringkasan" },
    { href: `${base}/jadwal`, label: "Jadwal & Hasil" },
    ...(format === "league" || hasGroups ? [{ href: `${base}/klasemen`, label: "Klasemen" }] : []),
    ...(format === "cup" ? [{ href: `${base}/bagan`, label: "Bagan Cup" }] : []),
    { href: `${base}/peserta`, label: "Peserta" },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "border-brand text-ink"
                : "border-transparent text-ink-muted hover:text-ink-secondary",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
