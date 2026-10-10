import type { Capability } from "@/lib/auth/rbac";

export type NavChild = { label: string; href: string };
export type NavItem = {
  key: string;
  label: string;
  /** Compact label for the mobile bottom bar. */
  short: string;
  href: string;
  icon: string; // lucide icon name
  hint: string;
  capability?: Capability;
  children?: NavChild[];
};

export const NAV: NavItem[] = [
  {
    key: "command-center",
    label: "Command Center",
    short: "Dasbor",
    href: "/command-center",
    icon: "LayoutDashboard",
    hint: "Dasbor operasional",
  },
  {
    key: "registry",
    label: "Master Data & Registry",
    short: "Registri",
    href: "/registry/pemain",
    icon: "Database",
    hint: "Basis data terpusat",
    capability: "registry:read",
    children: [
      { label: "Pemain", href: "/registry/pemain" },
      { label: "SSB", href: "/registry/klub" },
      { label: "Pelatih", href: "/registry/pelatih" },
      { label: "Wasit", href: "/registry/wasit" },
      { label: "Venue", href: "/registry/venue" },
      { label: "Kategori Usia", href: "/registry/kategori-usia" },
    ],
  },
  {
    key: "ingestion",
    label: "Data Ingestion & Staging",
    short: "Impor",
    href: "/ingestion",
    icon: "FileInput",
    hint: "Pipeline impor data",
    capability: "ingestion:read",
  },
  {
    key: "kompetisi",
    label: "Competition & Rules",
    short: "Kompetisi",
    href: "/kompetisi",
    icon: "Trophy",
    hint: "Turnamen & KU, jadwal, klasemen",
    capability: "competition:read",
  },
  {
    key: "match-ops",
    label: "Match Operations",
    short: "Laga",
    href: "/match-ops",
    icon: "Radio",
    hint: "Operasional pertandingan langsung",
    capability: "match:read",
  },
  {
    key: "player-intelligence",
    label: "Player Intelligence",
    short: "Analitik",
    href: "/player-intelligence",
    icon: "Radar",
    hint: "Analitik pemain & radar",
    capability: "intelligence:read",
    children: [
      { label: "Radar Performa", href: "/player-intelligence" },
      { label: "Perbandingan Pemain", href: "/player-intelligence/banding" },
      { label: "Formula Penilaian", href: "/player-intelligence/formula" },
      { label: "Galeri Lencana", href: "/player-intelligence/badge" },
    ],
  },
  {
    key: "ai-scout",
    label: "AI Scout & Insights",
    short: "AI Scout",
    href: "/ai-scout",
    icon: "Sparkles",
    hint: "Kecerdasan talenta berbasis AI",
    capability: "scout:use",
  },
];

export const SETTINGS_NAV: NavItem = {
  key: "pengaturan",
  label: "Pengaturan",
  short: "Atur",
  href: "/pengaturan",
  icon: "Settings",
  hint: "Konfigurasi & pengguna",
  capability: "settings:read",
};

export function findNavByPath(path: string): NavItem | undefined {
  return [...NAV, SETTINGS_NAV].find(
    (n) =>
      path === n.href ||
      path.startsWith("/" + n.key) ||
      n.children?.some((c) => path.startsWith(c.href)),
  );
}
