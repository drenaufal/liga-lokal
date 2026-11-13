import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { createT, type MessageId, type Vars } from "@/lib/i18n/translate";

const STORED = createT("id", {});

/**
 * The text of an audit entry. The trail is always written in Indonesian, whoever acts; each viewer
 * reads it in their own language through `localizeAudit` (lib/audit-display.ts).
 */
export function auditText(id: MessageId, vars?: Vars) {
  return STORED(id, vars);
}

const FIELD_LABEL: Record<string, string> = {
  fullName: "nama",
  nickname: "nama panggilan",
  nisn: "NISN",
  dob: "tanggal lahir",
  position: "posisi",
  foot: "kaki dominan",
  clubId: "klub",
  ageCategoryId: "kategori usia",
  name: "nama",
  shortName: "singkatan",
  type: "jenis",
  city: "kota",
  province: "provinsi",
  foundedYear: "tahun berdiri",
  logoUrl: "logo",
  photoUrl: "foto",
  kiaUrl: "dokumen KIA",
  kkUrl: "dokumen KK",
  aktaUrl: "akta kelahiran",
  ijazahUrl: "ijazah",
  raporUrl: "rapor",
  secondClubId: "klub kedua",
  birthPlace: "tempat lahir",
  heightCm: "tinggi",
  weightKg: "berat",
  jerseyNumber: "nomor punggung",
  guardianName: "nama wali",
  guardianPhone: "kontak wali",
  address: "alamat",
  askot: "Askot",
  asprov: "Asprov",
  contactName: "kontak",
  contactEmail: "email",
  contactPhone: "telepon",
  specialty: "peran",
  licenseLevel: "tingkat lisensi",
  licenseNumber: "nomor lisensi",
  licenseIssuedAt: "tanggal terbit",
  licenseExpiry: "masa berlaku",
  licenseDocUrl: "dokumen lisensi",
  ktpUrl: "KTP",
  status: "status",
  phone: "telepon",
  email: "email",
};

/** " (nama, logo)" style suffix for update summaries; empty when nothing changed. */
export function changedSuffix(fields: string[]) {
  const labels = [...new Set(fields.map((f) => FIELD_LABEL[f] ?? f))];
  return labels.length ? ` (${labels.join(", ")})` : "";
}

export async function recordAudit(input: {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      before: input.before,
      after: input.after,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
