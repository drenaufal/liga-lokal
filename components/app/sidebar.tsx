"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { NAV, SETTINGS_NAV } from "@/lib/nav";
import { can, type Role } from "@/lib/auth/rbac";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  const items = [...NAV, SETTINGS_NAV].filter(
    (n) => !n.capability || can(role, n.capability),
  );

  return (
    <aside
      className={cn(
        "sticky top-3 z-30 my-3 ml-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col overflow-hidden rounded-[1.75rem] bg-night text-white shadow-[0_24px_60px_-30px_rgba(20,20,20,0.7)] transition-[width] duration-200 [scrollbar-color:#3a3a3a_transparent] lg:flex",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-24 items-center", collapsed ? "justify-center px-3" : "px-5")}>
        <Link href="/command-center" aria-label={BRAND.name} className="flex items-center">
          <Logo className={collapsed ? "h-9" : "h-[72px]"} />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3 pt-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith("/" + item.key) ||
            item.children?.some((c) => pathname.startsWith(c.href));
          return (
            <div key={item.key}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-brand text-white shadow-[0_10px_24px_-12px_rgba(228,34,45,0.9)]"
                    : "text-night-muted hover:bg-night-2 hover:text-white",
                )}
              >
                <Icon name={item.icon} className="size-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
              {!collapsed && active && item.children && (
                <div className="my-1.5 ml-[22px] space-y-0.5 border-l border-night-line pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "block rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                        pathname === child.href
                          ? "bg-night-2 font-semibold text-white"
                          : "text-night-muted hover:text-white",
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          "m-3 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-xs text-night-muted transition-colors hover:bg-night-2 hover:text-white",
          collapsed && "justify-center",
        )}
      >
        {collapsed ? (
          <PanelLeft className="size-4" />
        ) : (
          <>
            <PanelLeftClose className="size-4" />
            Ciutkan panel
          </>
        )}
      </button>
    </aside>
  );
}
