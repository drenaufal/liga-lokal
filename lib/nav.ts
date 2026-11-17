import { can, type AccessSubject, type Capability } from "@/lib/auth/rbac";
import { msg } from "@/lib/i18n/translate";

// Labels are message ids: render them with `t.dyn(label)`.
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
    key: "dsp", label: msg("Daftar Susunan Pemain"), short: "DSP", href: "/dsp", icon: "ClipboardList",
    hint: msg("Submit susunan pemain klub"), capability: "dsp:view",
  },
  {
    key: "command-center",
    label: "Command Center",
    short: msg("Dasbor"),
    href: "/command-center",
    icon: "LayoutDashboard",
    hint: msg("Dasbor operasional"),
    capability: "dashboard:view",
  },
  {
    key: "registry",
    label: "Master Data & Registry",
    short: msg("Registri"),
    href: "/registry/pemain",
    icon: "Database",
    hint: msg("Basis data terpusat"),
    children: [
      { label: msg("Pemain"), href: "/registry/pemain", capability: "registry.player:view" },
      { label: msg("SSB"), href: "/registry/klub", capability: "registry.club:view" },
      { label: msg("Pelatih"), href: "/registry/pelatih", capability: "registry.coach:view" },
      { label: msg("Wasit"), href: "/registry/wasit", capability: "registry.referee:view" },
      { label: msg("Operator"), href: "/registry/operator", capability: "registry.operator:view" },
      { label: msg("Venue"), href: "/registry/venue", capability: "registry.venue:view" },
      { label: msg("Kategori Usia"), href: "/registry/kategori-usia", capability: "registry.category:view" },
    ],
  },
  {
    key: "ingestion",
    label: "Data Ingestion & Staging",
    short: msg("Impor"),
    href: "/ingestion",
    icon: "FileInput",
    hint: msg("Pipeline impor data"),
    capability: "ingestion:view",
  },
  {
    key: "kompetisi",
    label: "Competition & Rules",
    short: msg("Kompetisi"),
    href: "/kompetisi",
    icon: "Trophy",
    hint: msg("Turnamen & KU, jadwal, klasemen"),
    capability: "competition:view",
  },
  {
    key: "artikel",
    label: msg("Artikel"),
    short: msg("Artikel"),
    href: "/artikel",
    icon: "Newspaper",
    hint: msg("Berita & artikel"),
    capability: "article:view",
  },
  {
    key: "pemain",
    label: msg("Profil Pemain"),
    short: msg("Pemain"),
    href: "/pemain",
    icon: "Users",
    hint: msg("Profil publik pemain"),
    capability: "player-profile:view",
  },
  {
    key: "match-ops",
    label: "Match Operations",
    short: msg("Laga"),
    href: "/match-ops",
    icon: "Radio",
    hint: msg("Operasional pertandingan langsung"),
    capability: "match:view",
  },
  {
    key: "player-intelligence",
    label: "Player Intelligence",
    short: msg("Analitik"),
    href: "/player-intelligence",
    icon: "Radar",
    hint: msg("Analitik pemain & radar"),
    children: [
      { label: msg("Radar Performa"), href: "/player-intelligence", capability: "intelligence.radar:view" },
      { label: msg("Perbandingan Pemain"), href: "/player-intelligence/banding", capability: "intelligence.compare:view" },
      { label: msg("Formula Penilaian"), href: "/player-intelligence/formula", capability: "intelligence.formula:view" },
      { label: msg("Galeri Lencana"), href: "/player-intelligence/badge", capability: "intelligence.badge:view" },
    ],
  },
  {
    key: "ai-scout",
    label: "AI Scout & Insights",
    short: "AI Scout",
    href: "/ai-scout",
    icon: "Sparkles",
    hint: msg("Kecerdasan talenta berbasis AI"),
    capability: "scout:view",
  },
  {
    key: "keuangan",
    label: msg("Keuangan"),
    short: msg("Keuangan"),
    href: "/keuangan",
    icon: "Wallet",
    hint: msg("Monitoring keuangan unit bisnis"),
    capability: "finance:view",
    children: [
      { label: msg("Ringkasan"), href: "/keuangan", capability: "finance:view" },
      { label: msg("Aset"), href: "/keuangan/aset", capability: "finance:view" },
      { label: msg("Modal"), href: "/keuangan/modal", capability: "finance:view" },
      { label: msg("Dividen"), href: "/keuangan/dividen", capability: "finance:view" },
      { label: msg("Registrasi"), href: "/keuangan/registrasi", capability: "finance:view" },
      { label: msg("Match Fee"), href: "/keuangan/match-fee", capability: "finance:view" },
      { label: msg("RAB"), href: "/keuangan/rab", capability: "finance:view" },
      { label: msg("Unit Bisnis"), href: "/keuangan/unit", capability: "finance.units:manage" },
    ],
  },
];

export const SETTINGS_NAV: NavItem = {
  key: "pengaturan",
  label: msg("Pengaturan"),
  short: msg("Atur"),
  href: "/pengaturan",
  icon: "Settings",
  hint: msg("Konfigurasi & pengguna"),
  capability: "settings:view",
  children: [
    { label: msg("Umum"), href: "/pengaturan", capability: "settings:view" },
    { label: msg("Jejak Audit"), href: "/pengaturan/audit", capability: "audit:view" },
    { label: msg("Hak Akses Peran"), href: "/pengaturan/akses", capability: "access:manage" },
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
