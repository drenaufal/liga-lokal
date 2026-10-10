"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function CompetitionTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/kompetisi/${id}`;
  const tabs = [
    { href: base, label: "KU & Ringkasan" },
    { href: `${base}/jadwal`, label: "Jadwal Turnamen" },
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
