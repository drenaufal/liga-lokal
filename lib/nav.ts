import { can, type AccessSubject, type Capability } from "@/lib/auth/rbac";

export type NavChild = { label: string; href: string; capability?: Capability };
export type NavItem = {
  key: string;
  label: string;
  /** Compact label for the mobile bottom bar. */
  short: string;
  href: string;
  icon: string; // lucide icon name
  hint: string;
  /** Needed to see the menu (items with children are shown when any child is allowed). */
  capability?: Capability;
  children?: NavChild[];
};

export const NAV: NavItem[] = [
  {
    key: "dsp", label: "Daftar Susunan Pemain", short: "DSP", href: "/dsp", icon: "ClipboardList",
    hint: "Submit susunan pemain klub", capability: "dsp:view",
  },
  {
    key: "command-center",
    label: "Command Center",
    short: "Dasbor",
    href: "/command-center",
    icon: "LayoutDashboard",
    hint: "Dasbor operasional",
    capability: "dashboard:view",
  },
  {
    key: "registry",
    label: "Master Data & Registry",
    short: "Registri",
    href: "/registry/pemain",
    icon: "Database",
    hint: "Basis data terpusat",
    children: [
      { label: "Pemain", href: "/registry/pemain", capability: "registry.player:view" },
      { label: "SSB", href: "/registry/klub", capability: "registry.club:view" },
      { label: "Pelatih", href: "/registry/pelatih", capability: "registry.coach:view" },
      { label: "Wasit", href: "/registry/wasit", capability: "registry.referee:view" },
      { label: "Operator", href: "/registry/operator", capability: "registry.operator:view" },
      { label: "Venue", href: "/registry/venue", capability: "registry.venue:view" },
      { label: "Kategori Usia", href: "/registry/kategori-usia", capability: "registry.category:view" },
    ],
  },
  {
    key: "ingestion",
    label: "Data Ingestion & Staging",
    short: "Impor",
    href: "/ingestion",
    icon: "FileInput",
    hint: "Pipeline impor data",
    capability: "ingestion:view",
  },
  {
    key: "kompetisi",
    label: "Competition & Rules",
    short: "Kompetisi",
    href: "/kompetisi",
    icon: "Trophy",
    hint: "Turnamen & KU, jadwal, klasemen",
    capability: "competition:view",
  },
  {
    key: "match-ops",
    label: "Match Operations",
    short: "Laga",
    href: "/match-ops",
    icon: "Radio",
    hint: "Operasional pertandingan langsung",
    capability: "match:view",
  },
  {
    key: "player-intelligence",
    label: "Player Intelligence",
    short: "Analitik",
    href: "/player-intelligence",
    icon: "Radar",
    hint: "Analitik pemain & radar",
    children: [
      { label: "Radar Performa", href: "/player-intelligence", capability: "intelligence.radar:view" },
      { label: "Perbandingan Pemain", href: "/player-intelligence/banding", capability: "intelligence.compare:view" },
      { label: "Formula Penilaian", href: "/player-intelligence/formula", capability: "intelligence.formula:view" },
      { label: "Galeri Lencana", href: "/player-intelligence/badge", capability: "intelligence.badge:view" },
    ],
  },
  {
    key: "ai-scout",
    label: "AI Scout & Insights",
    short: "AI Scout",
    href: "/ai-scout",
    icon: "Sparkles",
    hint: "Kecerdasan talenta berbasis AI",
    capability: "scout:view",
  },
];

export const SETTINGS_NAV: NavItem = {
  key: "pengaturan",
  label: "Pengaturan",
  short: "Atur",
  href: "/pengaturan",
  icon: "Settings",
  hint: "Konfigurasi & pengguna",
  capability: "settings:view",
  children: [
    { label: "Umum", href: "/pengaturan", capability: "settings:view" },
    { label: "Jejak Audit", href: "/pengaturan/audit", capability: "audit:view" },
    { label: "Hak Akses Peran", href: "/pengaturan/akses", capability: "access:manage" },
  ],
};

export function findNavByPath(path: string): NavItem | undefined {
  return [...NAV, SETTINGS_NAV].find(
    (n) =>
      path === n.href ||
      path.startsWith("/" + n.key) ||
      n.children?.some((c) => path.startsWith(c.href)),
  );
}

/**
 * The menu one person sees: items they may open, with sub-menus they may open.
 * A menu with children is shown when at least one child is allowed and then points at
 * the first allowed child, so its link never lands on a page that would refuse them.
 */
export function navFor(subject: AccessSubject): NavItem[] {
  const out: NavItem[] = [];
  for (const item of [...NAV, SETTINGS_NAV]) {
    if (item.children) {
      const children = item.children.filter((c) => !c.capability || can(subject, c.capability));
      if (children.length === 0) continue;
      if (item.capability && !can(subject, item.capability)) continue;
      out.push({ ...item, href: children[0].href, children });
    } else if (!item.capability || can(subject, item.capability)) {
      out.push(item);
    }
  }
  return out;
}

/**
 * Where a person lands when they have no business on the page they asked for: the dashboard
 * when they may open it, otherwise their first allowed menu, otherwise nowhere (null).
 */
export function homeHref(subject: AccessSubject): string | null {
  const items = navFor(subject);
  return (items.find((i) => i.key === "command-center") ?? items[0])?.href ?? null;
}

/** Sub-menus of one module the person may open (used by each module's tab bar). */
export function allowedChildHrefs(moduleKey: string, subject: AccessSubject): string[] {
  const item = [...NAV, SETTINGS_NAV].find((n) => n.key === moduleKey);
  return (item?.children ?? []).filter((c) => !c.capability || can(subject, c.capability)).map((c) => c.href);
}

/** Capabilities that open any sub-menu of a module (for a layout that guards the whole module). */
export function moduleViewCaps(moduleKey: string): Capability[] {
  const item = [...NAV, SETTINGS_NAV].find((n) => n.key === moduleKey);
  return (item?.children ?? []).flatMap((c) => (c.capability ? [c.capability] : []));
}
