import type { ImportIssue, ImportStage } from "@/lib/db/schema";
import { PLAYER_POSITIONS, parsePosition } from "@/lib/positions";

/* ── CSV parsing (RFC-4180-ish, handles quoted fields) ─────────────── */
export function parseCsv(text: string, delimiter = ","): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      lines.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    lines.push(row);
  }

  const nonEmpty = lines.filter((l) => l.some((v) => v.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((l) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (l[idx] ?? "").trim()));
    return obj;
  });
  return { headers, rows };
}

/* ── Entity schemas ───────────────────────────────────────────────── */

export type EntitySchema = {
  required: string[];
  optional: string[];
  validate: (row: Record<string, string>) => ImportIssue[];
  normalize: (row: Record<string, string>) => Record<string, unknown>;
  matchKey: (row: Record<string, string>) => string;
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

export const ENTITY_SCHEMAS: Record<string, EntitySchema> = {
  players: {
    required: ["full_name", "dob", "position", "nisn"],
    optional: ["nickname", "nisn", "club_short", "age_category", "jersey_number", "height_cm", "weight_kg", "foot", "birth_place", "guardian_name", "guardian_phone"],
    validate: (r) => {
      const issues: ImportIssue[] = [];
      if (!r.full_name || r.full_name.length < 3)
        issues.push({ field: "full_name", code: "required", message: "Nama lengkap wajib (min 3 karakter)", severity: "error" });
      if (!isDate(r.dob))
        issues.push({ field: "dob", code: "format", message: "Tanggal lahir harus format YYYY-MM-DD", severity: "error" });
      const pos = parsePosition(r.position);
      if (!pos)
        issues.push({ field: "position", code: "enum", message: `Posisi harus salah satu dari ${PLAYER_POSITIONS.join("/")}`, severity: "error" });
      else if (pos.legacy)
        issues.push({ field: "position", code: "legacy", message: `Kode umum "${r.position}" dibaca sebagai ${pos.role} - tulis peran spesifik agar akurat`, severity: "warning" });
      if (r.jersey_number && (isNaN(+r.jersey_number) || +r.jersey_number < 1 || +r.jersey_number > 99))
        issues.push({ field: "jersey_number", code: "range", message: "Nomor punggung 1–99", severity: "warning" });
      if (r.dob && isDate(r.dob)) {
        const age = new Date().getFullYear() - new Date(r.dob).getFullYear();
        if (age < 5 || age > 20)
          issues.push({ field: "dob", code: "business", message: `Usia ${age} tahun di luar rentang wajar akar rumput`, severity: "warning" });
      }
      if (!r.nisn)
        issues.push({ field: "nisn", code: "required", message: "NISN wajib diisi (10 digit angka)", severity: "error" });
      else if (!/^\d{10}$/.test(r.nisn))
        issues.push({ field: "nisn", code: "format", message: "NISN harus 10 digit angka", severity: "error" });
      if (r.foot && !["left", "right", "both", "kiri", "kanan", "keduanya"].includes(r.foot.toLowerCase()))
        issues.push({ field: "foot", code: "enum", message: "Kaki dominan tidak dikenali", severity: "warning" });
      return issues;
    },
    normalize: (r) => ({
      fullName: r.full_name.replace(/\s+/g, " ").trim(),
      nickname: r.nickname || null,
      nisn: r.nisn,
      dob: r.dob,
      position: parsePosition(r.position)?.role ?? "",
      jerseyNumber: r.jersey_number ? Number(r.jersey_number) : null,
      heightCm: r.height_cm ? Number(r.height_cm) : null,
      weightKg: r.weight_kg ? Number(r.weight_kg) : null,
      foot: ({ kiri: "left", kanan: "right", keduanya: "both" }[r.foot?.toLowerCase()] ?? r.foot?.toLowerCase()) || "right",
      birthPlace: r.birth_place || null,
      guardianName: r.guardian_name || null,
      guardianPhone: r.guardian_phone || null,
      clubShort: r.club_short || null,
      ageCategory: r.age_category || null,
    }),
    matchKey: (r) => `${(r.full_name ?? "").toLowerCase().replace(/\s+/g, "")}|${r.dob ?? ""}`,
  },
  clubs: {
    required: ["name", "short_name", "city"],
    optional: ["type", "province", "address", "askot", "asprov", "founded_year", "contact_email"],
    validate: (r) => {
      const issues: ImportIssue[] = [];
      if (!r.name || r.name.length < 3)
        issues.push({ field: "name", code: "required", message: "Nama SSB wajib", severity: "error" });
      if (!r.short_name || r.short_name.length > 8)
        issues.push({ field: "short_name", code: "format", message: "Singkatan wajib (maks 8 karakter)", severity: "error" });
      if (!r.city)
        issues.push({ field: "city", code: "required", message: "Kota wajib diisi", severity: "error" });
      if (r.type && !["club", "academy", "klub", "akademi"].includes(r.type.toLowerCase()))
        issues.push({ field: "type", code: "enum", message: "Jenis harus club/academy", severity: "warning" });
      return issues;
    },
    normalize: (r) => ({
      name: r.name.trim(),
      shortName: r.short_name.toUpperCase(),
      city: r.city,
      province: r.province || null,
      address: r.address || null,
      askot: r.askot || null,
      asprov: r.asprov || null,
      type: ({ klub: "club", akademi: "academy" }[r.type?.toLowerCase()] ?? r.type?.toLowerCase()) || "club",
      foundedYear: r.founded_year ? Number(r.founded_year) : null,
      contactEmail: r.contact_email || null,
    }),
    matchKey: (r) => (r.name ?? "").toLowerCase().replace(/\s+/g, ""),
  },
  referees: {
    required: ["full_name", "license_level", "license_number", "license_expiry"],
    optional: ["city", "askot", "phone", "email"],
    validate: (r) => {
      const issues: ImportIssue[] = [];
      if (!r.full_name) issues.push({ field: "full_name", code: "required", message: "Nama wajib", severity: "error" });
      if (!r.license_number) issues.push({ field: "license_number", code: "required", message: "Nomor lisensi wajib", severity: "error" });
      if (!isDate(r.license_expiry)) issues.push({ field: "license_expiry", code: "format", message: "Tanggal kedaluwarsa harus YYYY-MM-DD", severity: "error" });
      return issues;
    },
    normalize: (r) => ({
      fullName: r.full_name.trim(),
      licenseLevel: r.license_level,
      licenseNumber: r.license_number,
      licenseExpiry: r.license_expiry,
      city: r.city || null,
      askot: r.askot || null,
      phone: r.phone || null,
      email: r.email || null,
    }),
    matchKey: (r) => (r.license_number ?? "").toLowerCase(),
  },
  venues: {
    required: ["name", "city"],
    optional: ["province", "capacity", "field_count", "surface"],
    validate: (r) => {
      const issues: ImportIssue[] = [];
      if (!r.name) issues.push({ field: "name", code: "required", message: "Nama venue wajib", severity: "error" });
      if (!r.city) issues.push({ field: "city", code: "required", message: "Kota wajib", severity: "error" });
      if (r.surface && !["natural", "artificial", "hybrid", "futsal"].includes(r.surface.toLowerCase()))
        issues.push({ field: "surface", code: "enum", message: "Permukaan tidak dikenali", severity: "warning" });
      return issues;
    },
    normalize: (r) => ({
      name: r.name.trim(),
      city: r.city,
      province: r.province || null,
      capacity: r.capacity ? Number(r.capacity) : null,
      fieldCount: r.field_count ? Number(r.field_count) : 1,
      surface: r.surface?.toLowerCase() || "natural",
    }),
    matchKey: (r) => (r.name ?? "").toLowerCase().replace(/\s+/g, ""),
  },
};

/* ── Fuzzy string similarity (Dice coefficient on bigrams) ─────────── */
export function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  a = norm(a);
  b = norm(b);
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [g, n] of A) overlap += Math.min(n, B.get(g) ?? 0);
  return (2 * overlap) / (a.length - 1 + b.length - 1);
}

/* ── 8-stage pipeline definition ──────────────────────────────────── */
export const STAGE_DEFS: { key: string; label: string }[] = [
  { key: "upload", label: "1 · Unggah & Baca Berkas" },
  { key: "schema", label: "2 · Validasi Skema Kolom" },
  { key: "normalize", label: "3 · Normalisasi Tipe & Format" },
  { key: "rules", label: "4 · Validasi Aturan Bisnis" },
  { key: "dedupe", label: "5 · Deteksi Duplikasi (Fuzzy Matching)" },
  { key: "crossref", label: "6 · Pencocokan Referensi (Klub/Venue)" },
  { key: "review", label: "7 · Antrian Tinjauan Manual" },
  { key: "commit", label: "8 · Commit ke Sistem & Jejak Audit" },
];

export function freshStages(): ImportStage[] {
  return STAGE_DEFS.map((s, i) => ({
    key: s.key,
    label: s.label,
    status: i === 0 ? "passed" : "pending",
  }));
}
