export type Role = "admin" | "operator" | "referee" | "coach" | "scout" | "viewer";

export const ROLES: Role[] = [
  "admin",
  "operator",
  "referee",
  "coach",
  "scout",
  "viewer",
];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  operator: "Operator Kompetisi",
  referee: "Wasit",
  coach: "Pelatih",
  scout: "Pemandu Bakat",
  viewer: "Peninjau",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: "Akses penuh ke seluruh modul, konfigurasi sistem, dan manajemen pengguna.",
  operator:
    "Mengelola kompetisi, jadwal, operasional pertandingan, dan data master.",
  referee: "Menjalankan konsol pertandingan yang ditugaskan dan validasi hasil.",
  coach: "Mengelola skuad klub sendiri dan meninjau analitik pemain.",
  scout: "Menggunakan AI Scout dan Player Intelligence untuk pemanduan bakat.",
  viewer: "Akses baca-saja ke dasbor dan laporan.",
};

/** Coarse capability keys used across the app. */
export type Capability =
  | "registry:read"
  | "registry:write"
  | "registry:verify"
  | "ingestion:read"
  | "ingestion:write"
  | "competition:read"
  | "competition:write"
  | "competition:delete"
  | "match:read"
  | "match:assign"
  | "match:operate"
  | "match:confirm"
  | "intelligence:read"
  | "formula:write"
  | "scout:use"
  | "settings:read"
  | "settings:write"
  | "audit:read";

const MATRIX: Record<Role, Capability[] | "*"> = {
  admin: "*",
  operator: [
    "registry:read",
    "registry:write",
    "registry:verify",
    "ingestion:read",
    "ingestion:write",
    "competition:read",
    "competition:write",
    "competition:delete",
    "match:read",
    "match:assign",
    "match:operate",
    "match:confirm",
    "intelligence:read",
    "scout:use",
    "settings:read",
    "audit:read",
  ],
  referee: [
    "registry:read",
    "competition:read",
    "match:read",
    "match:operate",
    "match:confirm",
    "intelligence:read",
  ],
  coach: [
    "registry:read",
    "competition:read",
    "match:read",
    "intelligence:read",
    "scout:use",
  ],
  scout: [
    "registry:read",
    "competition:read",
    "match:read",
    "intelligence:read",
    "scout:use",
  ],
  viewer: [
    "registry:read",
    "competition:read",
    "match:read",
    "intelligence:read",
  ],
};

export function can(role: Role | undefined | null, cap: Capability): boolean {
  if (!role) return false;
  const grants = MATRIX[role];
  if (grants === "*") return true;
  return grants.includes(cap);
}

export function assertCan(role: Role | undefined | null, cap: Capability) {
  if (!can(role, cap)) {
    throw new Error(
      `Akses ditolak: peran "${role ?? "tamu"}" tidak memiliki izin "${cap}".`,
    );
  }
}
