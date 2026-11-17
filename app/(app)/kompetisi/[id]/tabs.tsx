"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export function CompetitionTabs({ id }: { id: string }) {
  const t = useT();
  const pathname = usePathname();
  const base = `/kompetisi/${id}`;
  const tabs = [
    { href: base, label: t("KU & Ringkasan") },
    { href: `${base}/jadwal`, label: t("Jadwal Turnamen") },
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
