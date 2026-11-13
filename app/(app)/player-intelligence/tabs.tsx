"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, GitCompareArrows, Gauge, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";

const TABS = [
  { href: "/player-intelligence", label: msg("Radar Performa"), icon: Radar },
  { href: "/player-intelligence/banding", label: msg("Perbandingan Pemain"), icon: GitCompareArrows },
  { href: "/player-intelligence/formula", label: msg("Formula Penilaian"), icon: Gauge },
  { href: "/player-intelligence/badge", label: msg("Galeri Lencana"), icon: Award },
];

export function PiTabs({ allowed }: { allowed: string[] }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
      {TABS.filter((tab) => allowed.includes(tab.href)).map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "border-brand text-ink"
                : "border-transparent text-ink-muted hover:text-ink-secondary",
            )}
          >
            <tab.icon className="size-3.5" />
            {t(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
