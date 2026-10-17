"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, GitCompareArrows, Gauge, Award } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/player-intelligence", label: "Radar Performa", icon: Radar },
  { href: "/player-intelligence/banding", label: "Perbandingan Pemain", icon: GitCompareArrows },
  { href: "/player-intelligence/formula", label: "Formula Penilaian", icon: Gauge },
  { href: "/player-intelligence/badge", label: "Galeri Lencana", icon: Award },
];

export function PiTabs({ allowed }: { allowed: string[] }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
      {TABS.filter((t) => allowed.includes(t.href)).map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "border-brand text-ink"
                : "border-transparent text-ink-muted hover:text-ink-secondary",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
