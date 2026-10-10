"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Shield, Flag, MapPin, CalendarRange, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/registry/pemain", label: "Pemain", icon: Users },
  { href: "/registry/klub", label: "SSB", icon: Shield },
  { href: "/registry/pelatih", label: "Pelatih", icon: ClipboardList },
  { href: "/registry/wasit", label: "Wasit", icon: Flag },
  { href: "/registry/venue", label: "Venue", icon: MapPin },
  { href: "/registry/kategori-usia", label: "Kategori Usia", icon: CalendarRange },
];

export function RegistryTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-line pb-px">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
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
