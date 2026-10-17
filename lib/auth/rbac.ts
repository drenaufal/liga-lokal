/**
 * Role-based access control.
 *
 * Every menu, tab and action in the app is one capability. The catalog below is the single
 * source of truth: it defines the type, the screen shown to the Super Admin, the factory
 * defaults and which capability needs which. A Super Admin can override the defaults per
 * role on Pengaturan → Hak Akses Peran; overrides live in the `role_permissions` table.
 */

/**
 * `super_admin` is a hidden platform-owner role: it holds every capability, is the only role
 * that can edit the access matrix, and is never listed to (or assignable by) any other role.
 */
export type Role = "super_admin" | "admin" | "operator" | "referee" | "coach" | "scout" | "viewer";

export const ROLES: Role[] = [
  "super_admin",
  "admin",
  "operator",
  "referee",
  "coach",
  "scout",
  "viewer",
];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  operator: "Operator Kompetisi",
  referee: "Wasit",
  coach: "Pelatih",
  scout: "Pemandu Bakat",
  viewer: "Peninjau",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  super_admin: "Pemilik platform: seluruh izin, termasuk pengaturan hak akses semua peran.",
  admin: "Akses penuh ke seluruh modul, konfigurasi sistem, dan manajemen pengguna.",
  operator:
    "Mengelola kompetisi, jadwal, operasional pertandingan, dan data master.",
  referee: "Menjalankan konsol pertandingan yang ditugaskan dan validasi hasil.",
  coach: "Mengelola skuad klub sendiri dan meninjau analitik pemain.",
  scout: "Menggunakan AI Scout dan Player Intelligence untuk pemanduan bakat.",
  viewer: "Akses baca-saja ke dasbor dan laporan.",
};

/** Roles whose access can be edited. Super Admin is fixed so nobody can lock themselves out. */
export type EditableRole = Exclude<Role, "super_admin">;
export const EDITABLE_ROLES: EditableRole[] = ROLES.filter(
  (r): r is EditableRole => r !== "super_admin",
);

/**
 * Roles that can be handed out from Pengaturan → Manajemen Pengguna. Super Admin is hidden, and a
 * coach account is created from the coach's own profile (Registry → Pelatih) because it is tied to that record.
 */
export const ASSIGNABLE_ROLES = ["admin", "operator", "referee", "scout", "viewer"] as const satisfies readonly Role[];

/** Hidden roles are never shown to, or counted for, anyone but themselves. */
export const HIDDEN_ROLES: readonly Role[] = ["super_admin"];
export function canSeeRole(viewer: Role | null | undefined, target: Role) {
  return !HIDDEN_ROLES.includes(target) || viewer === target;
}

/* ───────────────────────────── Catalog ───────────────────────────── */

/** menu = opens a page or tab; feature = something you can do (or see) on it. */
export type CapabilityKind = "menu" | "feature";

type Def = {
  label: string;
  description: string;
  kind: CapabilityKind;
  /** Must be held too (the "view" of the same menu). Toggling in the matrix honours this. */
  requires?: Capability;
  /** Roles that have it out of the box. Administrator gets every grantable capability automatically. */
  defaults: readonly EditableRole[];
};

const EVERYONE: readonly EditableRole[] = ["operator", "referee", "coach", "scout", "viewer"];
const OPERATOR: readonly EditableRole[] = ["operator"];
const MATCH_CREW: readonly EditableRole[] = ["operator", "referee"];
const SCOUTING: readonly EditableRole[] = ["operator", "coach", "scout"];
const NOBODY_ELSE: readonly EditableRole[] = [];

const GROUPS = [
  { id: "dashboard", title: "Command Center", caps: ["dashboard:view", "dashboard:activity"] },
  { id: "dsp", title: "Daftar Susunan Pemain (DSP)", caps: ["dsp:view", "dsp:submit", "dsp:any-club"] },
  {
    id: "registry-player",
    title: "Master Data — Pemain",
    caps: ["registry.player:view", "registry.player:create", "registry.player:edit", "registry.player:verify"],
  },
  { id: "registry-club", title: "Master Data — SSB", caps: ["registry.club:view", "registry.club:create", "registry.club:edit"] },
  {
    id: "registry-coach",
    title: "Master Data — Pelatih",
    caps: ["registry.coach:view", "registry.coach:create", "registry.coach:edit", "registry.coach:account"],
  },
  { id: "registry-referee", title: "Master Data — Wasit", caps: ["registry.referee:view", "registry.referee:create", "registry.referee:edit"] },
  { id: "registry-operator", title: "Master Data — Operator", caps: ["registry.operator:view", "registry.operator:create", "registry.operator:edit"] },
  { id: "registry-venue", title: "Master Data — Venue", caps: ["registry.venue:view", "registry.venue:create", "registry.venue:edit"] },
  {
    id: "registry-category",
    title: "Master Data — Kategori Usia",
    caps: ["registry.category:view", "registry.category:create", "registry.category:edit", "registry.category:delete"],
  },
  { id: "registry-documents", title: "Master Data — Dokumen Pribadi", caps: ["registry:documents"] },
  { id: "ingestion", title: "Data Ingestion & Staging", caps: ["ingestion:view", "ingestion:upload", "ingestion:review", "ingestion:commit"] },
  {
    id: "competition",
    title: "Competition & Rules — Turnamen",
    caps: ["competition:view", "competition:create", "competition:edit", "competition:delete"],
  },
  {
    id: "ku",
    title: "Competition & Rules — KU, Peserta & Jadwal",
    caps: ["ku:create", "ku:status", "ku:teams", "ku:fixtures", "ku:schedule", "ku:match-delete", "ku:delete"],
  },
  {
    id: "match",
    title: "Match Operations",
    caps: [
      "match:view",
      "match:assign",
      "match:squad",
      "match:operate",
      "match:events",
      "match:void",
      "match:undo-any",
      "match:confirm",
      "match:amend",
    ],
  },
  {
    id: "intelligence",
    title: "Player Intelligence",
    caps: [
      "intelligence.radar:view",
      "intelligence.compare:view",
      "intelligence.formula:view",
      "intelligence.formula:edit",
      "intelligence.formula:activate",
      "intelligence.badge:view",
      "intelligence.badge:select",
    ],
  },
  { id: "scout", title: "AI Scout & Insights", caps: ["scout:view", "scout:search", "scout:shortlist", "scout:report"] },
  {
    id: "settings",
    title: "Pengaturan & Keamanan",
    caps: ["settings:view", "settings:users", "settings.users:create", "settings.users:edit", "audit:view", "access:manage"],
  },
] as const;

export type Capability = (typeof GROUPS)[number]["caps"][number];

const DEFS: Record<Capability, Def> = {
  /* Command Center */
  "dashboard:view": {
    label: "Membuka Command Center",
    description: "Dasbor operasional: KPI, pertandingan langsung, sebaran verifikasi, dan papan peringkat.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "dashboard:activity": {
    label: "Melihat aktivitas terbaru",
    description: "Panel aktivitas di Command Center (siapa mengubah apa dan kapan).",
    kind: "feature",
    requires: "dashboard:view",
    defaults: EVERYONE,
  },

  /* DSP */
  "dsp:view": {
    label: "Membuka menu DSP",
    description: "Halaman Daftar Susunan Pemain per pertandingan.",
    kind: "menu",
    defaults: ["coach"],
  },
  "dsp:submit": {
    label: "Mengirim / merevisi DSP",
    description: "Menyimpan susunan pemain. Untuk akun yang terhubung ke sebuah SSB, DSP berlaku untuk SSB tersebut.",
    kind: "feature",
    requires: "dsp:view",
    defaults: ["coach"],
  },
  "dsp:any-club": {
    label: "Mengisi DSP untuk SSB mana pun",
    description: "Memilih sendiri SSB dan pelatih penanggung jawab, tidak terikat pada satu SSB.",
    kind: "feature",
    requires: "dsp:submit",
    defaults: NOBODY_ELSE,
  },

  /* Registry — Pemain */
  "registry.player:view": {
    label: "Membuka daftar & profil pemain",
    description: "Tab Pemain: daftar, pencarian, profil, statistik per kompetisi.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "registry.player:create": {
    label: "Mendaftarkan pemain baru",
    description: "Tombol Tambah Pemain dan formulir registrasi (termasuk unggah foto & dokumen).",
    kind: "feature",
    requires: "registry.player:view",
    defaults: OPERATOR,
  },
  "registry.player:edit": {
    label: "Mengubah data pemain",
    description: "Tombol Ubah data pada profil pemain (termasuk unggah foto & dokumen).",
    kind: "feature",
    requires: "registry.player:view",
    defaults: OPERATOR,
  },
  "registry.player:verify": {
    label: "Memverifikasi pemain",
    description: "Menyetujui, menandai, atau menolak status verifikasi pemain.",
    kind: "feature",
    requires: "registry.player:view",
    defaults: OPERATOR,
  },

  /* Registry — SSB */
  "registry.club:view": {
    label: "Membuka daftar & profil SSB",
    description: "Tab SSB: daftar, profil, riwayat kompetisi.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "registry.club:create": {
    label: "Mendaftarkan SSB baru",
    description: "Tombol Tambah SSB dan formulir registrasi.",
    kind: "feature",
    requires: "registry.club:view",
    defaults: OPERATOR,
  },
  "registry.club:edit": {
    label: "Mengubah data SSB",
    description: "Mengubah profil, logo, dan dokumen SSB.",
    kind: "feature",
    requires: "registry.club:view",
    defaults: OPERATOR,
  },

  /* Registry — Pelatih */
  "registry.coach:view": {
    label: "Membuka daftar & profil pelatih",
    description: "Tab Pelatih: daftar dan profil pelatih.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "registry.coach:create": {
    label: "Mendaftarkan pelatih baru",
    description: "Tombol Tambah Pelatih dan formulir registrasi.",
    kind: "feature",
    requires: "registry.coach:view",
    defaults: OPERATOR,
  },
  "registry.coach:edit": {
    label: "Mengubah data pelatih",
    description: "Mengubah profil, lisensi, dan dokumen pelatih.",
    kind: "feature",
    requires: "registry.coach:view",
    defaults: OPERATOR,
  },
  "registry.coach:account": {
    label: "Mengelola akun login pelatih",
    description: "Membuat/mengubah email, kata sandi, dan status akun login pelatih (untuk mengisi DSP).",
    kind: "feature",
    requires: "registry.coach:view",
    defaults: NOBODY_ELSE,
  },

  /* Registry — Wasit */
  "registry.referee:view": {
    label: "Membuka daftar & profil wasit",
    description: "Tab Wasit: daftar dan profil wasit.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "registry.referee:create": {
    label: "Mendaftarkan wasit baru",
    description: "Tombol Tambah Wasit dan formulir registrasi.",
    kind: "feature",
    requires: "registry.referee:view",
    defaults: OPERATOR,
  },
  "registry.referee:edit": {
    label: "Mengubah data wasit",
    description: "Mengubah profil dan lisensi wasit.",
    kind: "feature",
    requires: "registry.referee:view",
    defaults: OPERATOR,
  },

  /* Registry — Operator */
  "registry.operator:view": {
    label: "Membuka daftar operator",
    description: "Tab Operator: daftar akun operator pertandingan.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "registry.operator:create": {
    label: "Membuat akun operator",
    description: "Membuat akun login operator (nama, email, kata sandi).",
    kind: "feature",
    requires: "registry.operator:view",
    defaults: NOBODY_ELSE,
  },
  "registry.operator:edit": {
    label: "Mengubah / menonaktifkan akun operator",
    description: "Mengubah nama, email, kata sandi, dan status aktif operator.",
    kind: "feature",
    requires: "registry.operator:view",
    defaults: NOBODY_ELSE,
  },

  /* Registry — Venue */
  "registry.venue:view": {
    label: "Membuka daftar & detail venue",
    description: "Tab Venue: daftar dan detail venue.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "registry.venue:create": {
    label: "Menambah venue",
    description: "Tombol Tambah Venue dan formulirnya.",
    kind: "feature",
    requires: "registry.venue:view",
    defaults: OPERATOR,
  },
  "registry.venue:edit": {
    label: "Mengubah venue",
    description: "Mengubah data dan foto sampul venue.",
    kind: "feature",
    requires: "registry.venue:view",
    defaults: OPERATOR,
  },

  /* Registry — Kategori Usia */
  "registry.category:view": {
    label: "Membuka kategori usia",
    description: "Tab Kategori Usia: aturan KU-8 … KU-16.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "registry.category:create": {
    label: "Menambah kategori usia",
    description: "Membuat kategori usia baru beserta aturan pertandingannya.",
    kind: "feature",
    requires: "registry.category:view",
    defaults: OPERATOR,
  },
  "registry.category:edit": {
    label: "Mengubah kategori usia",
    description: "Mengubah batas usia dan aturan pertandingan.",
    kind: "feature",
    requires: "registry.category:view",
    defaults: OPERATOR,
  },
  "registry.category:delete": {
    label: "Menghapus kategori usia",
    description: "Menghapus kategori usia yang belum dipakai.",
    kind: "feature",
    requires: "registry.category:view",
    defaults: OPERATOR,
  },

  /* Registry — documents */
  "registry:documents": {
    label: "Membuka dokumen identitas & lisensi",
    description: "KIA, KK, akta, ijazah, rapor pemain; KTP dan lisensi pelatih; dokumen SSB. Berkas bersifat privat.",
    kind: "feature",
    defaults: OPERATOR,
  },

  /* Ingestion */
  "ingestion:view": {
    label: "Membuka Data Ingestion",
    description: "Riwayat impor, detail batch, pipeline QA, dan baris staging.",
    kind: "menu",
    defaults: OPERATOR,
  },
  "ingestion:upload": {
    label: "Mengunggah berkas CSV",
    description: "Membuat batch impor baru dari berkas CSV.",
    kind: "feature",
    requires: "ingestion:view",
    defaults: OPERATOR,
  },
  "ingestion:review": {
    label: "Menjalankan validasi & meninjau baris",
    description: "Menjalankan pipeline QA, menyetujui/menolak/menggabungkan baris (satuan atau massal).",
    kind: "feature",
    requires: "ingestion:view",
    defaults: OPERATOR,
  },
  "ingestion:commit": {
    label: "Commit batch ke sistem",
    description: "Memasukkan baris yang valid ke registry.",
    kind: "feature",
    requires: "ingestion:view",
    defaults: OPERATOR,
  },

  /* Competition — Turnamen */
  "competition:view": {
    label: "Membuka Competition & Rules",
    description: "Daftar turnamen, KU, jadwal, klasemen, bagan, dan peserta.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "competition:create": {
    label: "Membuat turnamen",
    description: "Tombol Turnamen Baru.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },
  "competition:edit": {
    label: "Mengubah turnamen",
    description: "Mengubah nama, musim, penyelenggara, dan deskripsi turnamen.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },
  "competition:delete": {
    label: "Menghapus turnamen",
    description: "Menghapus turnamen beserta seluruh KU, jadwal, dan hasilnya.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },

  /* Competition — KU */
  "ku:create": {
    label: "Menambah KU",
    description: "Membuat KU baru di dalam turnamen (kategori usia, format Liga/Cup, tanggal).",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },
  "ku:status": {
    label: "Mengubah status siklus KU",
    description: "Menggeser KU antar tahap: draft, pendaftaran, verifikasi, siap, berlangsung, selesai, arsip.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },
  "ku:teams": {
    label: "Mengelola peserta KU",
    description: "Menambah dan mengeluarkan SSB peserta.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },
  "ku:fixtures": {
    label: "Membuat jadwal otomatis & hitung ulang klasemen",
    description: "Menghasilkan fixture Liga/Cup otomatis dan menghitung ulang klasemen.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },
  "ku:schedule": {
    label: "Menambah pertandingan manual & impor jadwal CSV",
    description: "Tombol Tambah Pertandingan dan unggah jadwal dari berkas CSV.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },
  "ku:match-delete": {
    label: "Menghapus pertandingan terjadwal",
    description: "Menghapus pertandingan yang belum dimulai dari jadwal.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },
  "ku:delete": {
    label: "Menghapus KU",
    description: "Menghapus KU beserta jadwal dan hasilnya.",
    kind: "feature",
    requires: "competition:view",
    defaults: OPERATOR,
  },

  /* Match Ops */
  "match:view": {
    label: "Membuka Match Operations",
    description: "Daftar pertandingan, konsol, lini masa, dan statistik pertandingan.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "match:assign": {
    label: "Menugaskan wasit & operator",
    description: "Menentukan wasit dan operator pencatat untuk pertandingan terjadwal.",
    kind: "feature",
    requires: "match:view",
    defaults: OPERATOR,
  },
  "match:squad": {
    label: "Memilih pemain pertandingan",
    description: "Menentukan starter dan cadangan kedua tim sebelum kick-off.",
    kind: "feature",
    requires: "match:view",
    defaults: OPERATOR,
  },
  "match:operate": {
    label: "Mengendalikan jam pertandingan",
    description: "Memulai, menjeda, melanjutkan babak kedua, dan mengakhiri pertandingan.",
    kind: "feature",
    requires: "match:view",
    defaults: MATCH_CREW,
  },
  "match:events": {
    label: "Mencatat kejadian",
    description: "Gol, kartu, pergantian pemain, dan kejadian lain (satu ketukan maupun formulir lengkap).",
    kind: "feature",
    requires: "match:view",
    defaults: MATCH_CREW,
  },
  "match:void": {
    label: "Membatalkan kejadian dari lini masa",
    description: "Membatalkan (void) kejadian yang salah catat lewat lini masa.",
    kind: "feature",
    requires: "match:view",
    defaults: MATCH_CREW,
  },
  "match:undo-any": {
    label: "Membatalkan kejadian milik pencatat lain",
    description: "Tanpa izin ini, batal cepat hanya untuk kejadian yang dicatat sendiri.",
    kind: "feature",
    requires: "match:events",
    defaults: NOBODY_ELSE,
  },
  "match:confirm": {
    label: "Mengonfirmasi hasil & adu penalti",
    description: "Mengonfirmasi hasil akhir dan mengisi skor adu penalti pertandingan gugur.",
    kind: "feature",
    requires: "match:view",
    defaults: MATCH_CREW,
  },
  "match:amend": {
    label: "Mengoreksi hasil terkonfirmasi",
    description: "Mengubah hasil yang sudah dikonfirmasi (alasan wajib dan tercatat di audit).",
    kind: "feature",
    requires: "match:view",
    defaults: MATCH_CREW,
  },

  /* Player Intelligence */
  "intelligence.radar:view": {
    label: "Membuka Radar Performa",
    description: "Tab Radar Performa dengan filter pemain.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "intelligence.compare:view": {
    label: "Membuka Perbandingan Pemain",
    description: "Tab untuk membandingkan pemain berdampingan.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "intelligence.formula:view": {
    label: "Membuka Formula Penilaian",
    description: "Tab formula dan pratinjau dampaknya pada papan peringkat.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "intelligence.formula:edit": {
    label: "Mengubah formula penilaian",
    description: "Mengubah nama dan bobot metrik lalu menyimpannya (naik versi).",
    kind: "feature",
    requires: "intelligence.formula:view",
    defaults: NOBODY_ELSE,
  },
  "intelligence.formula:activate": {
    label: "Mengaktifkan formula penilaian",
    description: "Menjadikan satu formula aktif; skor & rating seluruh pemain dihitung ulang.",
    kind: "feature",
    requires: "intelligence.formula:view",
    defaults: NOBODY_ELSE,
  },
  "intelligence.badge:view": {
    label: "Membuka Galeri Lencana",
    description: "Tab lencana dan para penerimanya.",
    kind: "menu",
    defaults: EVERYONE,
  },
  "intelligence.badge:select": {
    label: "Memilih pemain terbaik (MVP)",
    description: "Menetapkan lencana pemain terbaik secara manual.",
    kind: "feature",
    requires: "intelligence.badge:view",
    defaults: OPERATOR,
  },

  /* AI Scout */
  "scout:view": {
    label: "Membuka AI Scout & Insights",
    description: "Daftar laporan, shortlist tersimpan, dan detail laporan.",
    kind: "menu",
    defaults: SCOUTING,
  },
  "scout:search": {
    label: "Mencari talenta",
    description: "Pencarian talenta dengan bahasa natural.",
    kind: "feature",
    requires: "scout:view",
    defaults: SCOUTING,
  },
  "scout:shortlist": {
    label: "Menyimpan shortlist",
    description: "Menyimpan hasil pencarian sebagai shortlist.",
    kind: "feature",
    requires: "scout:view",
    defaults: SCOUTING,
  },
  "scout:report": {
    label: "Membuat laporan AI",
    description: "Membuat laporan analisis pemain, ringkasan laga, dan wawasan kompetisi.",
    kind: "feature",
    requires: "scout:view",
    defaults: SCOUTING,
  },

  /* Settings */
  "settings:view": {
    label: "Membuka Pengaturan",
    description: "Halaman Pengaturan: profil organisasi, ringkasan data, dan konfigurasi sistem.",
    kind: "menu",
    defaults: OPERATOR,
  },
  "settings:users": {
    label: "Melihat daftar pengguna",
    description: "Tabel pengguna & peran (nama, email, status, login terakhir) di Pengaturan.",
    kind: "feature",
    requires: "settings:view",
    defaults: OPERATOR,
  },
  "settings.users:create": {
    label: "Menambah pengguna",
    description: "Membuat akun pengguna baru beserta perannya di Pengaturan. Hanya Administrator yang dapat memberi peran Administrator.",
    kind: "feature",
    requires: "settings:users",
    defaults: NOBODY_ELSE,
  },
  "settings.users:edit": {
    label: "Mengubah pengguna & peran",
    description: "Mengubah nama, email, kata sandi, peran, dan status akun di Pengaturan.",
    kind: "feature",
    requires: "settings:users",
    defaults: NOBODY_ELSE,
  },
  "audit:view": {
    label: "Membuka jejak audit",
    description: "Log audit menyeluruh: pelaku, aksi, dan waktu.",
    kind: "feature",
    requires: "settings:view",
    defaults: OPERATOR,
  },
  "access:manage": {
    label: "Mengatur hak akses peran",
    description: "Mengubah matriks izin pada layar Hak Akses Peran. Khusus Super Admin.",
    kind: "feature",
    requires: "settings:view",
    defaults: NOBODY_ELSE,
  },
};

export type CapabilityGroup = { id: string; title: string; caps: Capability[] };

export const CAPABILITY_GROUPS: CapabilityGroup[] = GROUPS.map((g) => ({
  id: g.id,
  title: g.title,
  caps: [...g.caps] as Capability[],
}));

export const ALL_CAPABILITIES: Capability[] = CAPABILITY_GROUPS.flatMap((g) => g.caps);

/** Display metadata for the access-management screen (Bahasa Indonesia). */
export const CAPABILITY_INFO: Record<Capability, { label: string; description: string; kind: CapabilityKind }> =
  Object.fromEntries(
    ALL_CAPABILITIES.map((c) => [c, { label: DEFS[c].label, description: DEFS[c].description, kind: DEFS[c].kind }]),
  ) as Record<Capability, { label: string; description: string; kind: CapabilityKind }>;

/** A capability that needs another one to be usable (a button on a page you cannot open is useless). */
export const REQUIRES: Partial<Record<Capability, Capability>> = Object.fromEntries(
  ALL_CAPABILITIES.filter((c) => DEFS[c].requires).map((c) => [c, DEFS[c].requires]),
) as Partial<Record<Capability, Capability>>;

/**
 * Capabilities that only certain roles may ever hold, whatever the matrix says.
 * Granting access:manage further would let a role rewrite the matrix itself.
 */
export const RESTRICTED: Partial<Record<Capability, readonly Role[]>> = {
  "access:manage": ["super_admin"],
};

/** Can this role ever hold the capability (independent of what is currently saved)? */
export function isHoldable(role: Role, cap: Capability) {
  return role === "super_admin" || !RESTRICTED[cap] || RESTRICTED[cap]!.includes(role);
}

/* ───────────────────────────── Resolution ───────────────────────────── */

/**
 * Attaching photos or documents happens inside the registry forms, so anyone who may create
 * or edit one of those records may upload files.
 */
export const FILE_UPLOAD_CAPS: readonly Capability[] = [
  "registry.player:create",
  "registry.player:edit",
  "registry.club:create",
  "registry.club:edit",
  "registry.coach:create",
  "registry.coach:edit",
  "registry.referee:create",
  "registry.referee:edit",
  "registry.venue:create",
  "registry.venue:edit",
];

/**
 * Per-role deviations from the factory defaults, as saved by a Super Admin.
 * `true` grants a capability the role does not have by default, `false` revokes one it does.
 */
export type RoleOverrides = Partial<Record<EditableRole, Partial<Record<Capability, boolean>>>>;

/** Complete grant sets for the editable roles (Super Admin is implicit). */
export type GrantMatrix = Record<EditableRole, Capability[]>;

/** Factory defaults: Administrator gets everything grantable, other roles what the catalog lists. */
export function defaultGrants(role: Role): Capability[] {
  if (role === "super_admin") return [...ALL_CAPABILITIES];
  if (role === "admin") return ALL_CAPABILITIES.filter((c) => isHoldable(role, c));
  return ALL_CAPABILITIES.filter((c) => DEFS[c].defaults.includes(role as EditableRole));
}

/**
 * Closes a grant set under {@link REQUIRES} and strips capabilities the role can never hold.
 * Revoking a base permission also drops everything that depended on it.
 */
export function normalizeGrants(role: Role, grants: Iterable<Capability>): Capability[] {
  const set = new Set<Capability>();
  for (const cap of grants) if (isHoldable(role, cap)) set.add(cap);
  // drop anything whose prerequisite is missing (repeat: chains such as undo-any → events → view)
  let changed = true;
  while (changed) {
    changed = false;
    for (const cap of [...set]) {
      const need = REQUIRES[cap];
      if (need && !set.has(need)) {
        set.delete(cap);
        changed = true;
      }
    }
  }
  return ALL_CAPABILITIES.filter((c) => set.has(c));
}

/** The capabilities of one role: factory defaults with the saved overrides applied. */
export function resolveGrants(role: Role, overrides?: RoleOverrides | null): Capability[] {
  if (role === "super_admin") return [...ALL_CAPABILITIES];
  const set = new Set<Capability>(defaultGrants(role));
  for (const [cap, granted] of Object.entries(overrides?.[role as EditableRole] ?? {}) as [Capability, boolean][]) {
    if (granted) set.add(cap);
    else set.delete(cap);
  }
  return normalizeGrants(role, set);
}

/** Turns the full matrix the Super Admin edited back into minimal overrides against the defaults. */
export function diffAgainstDefaults(matrix: GrantMatrix): RoleOverrides {
  const out: RoleOverrides = {};
  for (const role of EDITABLE_ROLES) {
    const wanted = new Set(normalizeGrants(role, matrix[role] ?? []));
    const base = new Set(normalizeGrants(role, defaultGrants(role)));
    const diff: Partial<Record<Capability, boolean>> = {};
    for (const cap of ALL_CAPABILITIES) {
      if (!isHoldable(role, cap)) continue;
      if (wanted.has(cap) !== base.has(cap)) diff[cap] = wanted.has(cap);
    }
    if (Object.keys(diff).length) out[role] = diff;
  }
  return out;
}

/**
 * Who is asking. A bare role falls back to the factory defaults; a subject
 * carrying `grants` (resolved from the saved access matrix) is authoritative.
 */
export type AccessSubject =
  | Role
  | null
  | undefined
  | { role?: Role | null; grants?: readonly Capability[] | null };

export function can(subject: AccessSubject, cap: Capability): boolean {
  const role = typeof subject === "object" && subject ? subject.role : (subject as Role | null | undefined);
  if (!role) return false;
  if (role === "super_admin") return true;
  if (!isHoldable(role, cap)) return false;
  if (typeof subject === "object" && subject?.grants) return subject.grants.includes(cap);
  return resolveGrants(role).includes(cap);
}

/** True when the subject holds at least one of the capabilities. */
export function canAny(subject: AccessSubject, caps: readonly Capability[]): boolean {
  return caps.some((c) => can(subject, c));
}

export function assertCan(subject: AccessSubject, cap: Capability) {
  if (!can(subject, cap)) {
    const role = typeof subject === "object" && subject ? subject.role : subject;
    throw new Error(
      `Akses ditolak: peran "${role ?? "tamu"}" tidak memiliki izin "${cap}".`,
    );
  }
}
