"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Shield, Flag, MapPin, CalendarRange, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { msg } from "@/lib/i18n/translate";
import { useT } from "@/lib/i18n/client";

const TABS = [
  { href: "/registry/pemain", label: msg("Pemain"), icon: Users },
  { href: "/registry/klub", label: msg("SSB"), icon: Shield },
  { href: "/registry/pelatih", label: msg("Pelatih"), icon: ClipboardList },
  { href: "/registry/wasit", label: msg("Wasit"), icon: Flag },
  { href: "/registry/operator", label: msg("Operator"), icon: Users },
  { href: "/registry/venue", label: msg("Venue"), icon: MapPin },
  { href: "/registry/kategori-usia", label: msg("Kategori Usia"), icon: CalendarRange },
];

export function RegistryTabs({ allowed }: { allowed: string[] }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-line pb-px">
      {TABS.filter((tab) => allowed.includes(tab.href)).map((tab) => {
        const active = pathname.startsWith(tab.href);
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
            {t.dyn(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
