"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { coaches } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { changedSuffix, recordAudit } from "@/lib/audit";
import { documentUrlField, imageUrlField } from "@/lib/media";
import { releaseReplaced } from "@/lib/media-store";
import { COACH_DOCUMENT_KEYS } from "@/lib/coach-documents";
import { formError, type FormState } from "@/lib/form";
import { COACH_LICENSE_LEVELS, COACH_SPECIALTIES } from "@/lib/status";
import { insertReturning } from "@/lib/db/returning";

const optionalDate = z
  .string()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Tanggal tidak valid")
  .optional();

const coachSchema = z.object({
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter"),
  dob: optionalDate,
  city: z.string().trim().optional(),
  clubId: z.string().optional(),
  specialty: z
    .string()
    .refine((v) => v === "" || COACH_SPECIALTIES.includes(v), "Peran tidak dikenali")
    .optional(),
  licenseLevel: z
    .string()
    .refine((v) => COACH_LICENSE_LEVELS.includes(v), "Pilih tingkat lisensi"),
  licenseNumber: z.string().trim().toUpperCase().min(3, "Nomor lisensi wajib diisi").max(40),
  licenseDocUrl: documentUrlField,
  ktpUrl: documentUrlField,
  photoUrl: imageUrlField,
  phone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email("Email tidak valid")]).optional(),
});

type CoachInput = z.infer<typeof coachSchema>;

function toRow(v: CoachInput) {
  return {
    fullName: v.fullName,
    dob: v.dob || null,
    city: v.city || null,
    clubId: v.clubId || null,
    specialty: v.specialty || null,
    licenseLevel: v.licenseLevel,
    licenseNumber: v.licenseNumber,
    licenseDocUrl: v.licenseDocUrl || null,
    ktpUrl: v.ktpUrl || null,
    photoUrl: v.photoUrl || null,
    phone: v.phone || null,
    email: v.email || null,
  };
}

async function licenseTaken(licenseNumber: string, exceptId?: string) {
  const hit = await db.query.coaches.findFirst({
    where: exceptId
      ? and(eq(coaches.licenseNumber, licenseNumber), ne(coaches.id, exceptId))
      : eq(coaches.licenseNumber, licenseNumber),
    columns: { fullName: true },
  });
  return hit ? `Nomor lisensi sudah terdaftar atas nama ${hit.fullName}` : null;
}

function revalidateCoach(id: string, clubIds: (string | null)[]) {
  revalidatePath("/registry/pelatih");
  revalidatePath(`/registry/pelatih/${id}`);
  for (const c of new Set(clubIds)) if (c) revalidatePath(`/registry/klub/${c}`);
}

export async function createCoach(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser("registry:write");
  const parsed = coachSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await licenseTaken(row.licenseNumber);
  if (taken) return formError({ licenseNumber: taken }, formData);

  const [created] = await insertReturning(db, coaches, row);

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "coach.create",
    entityType: "coach",
    entityId: created.id,
    summary: `Registrasi pelatih baru: ${row.fullName} (${row.licenseLevel} · ${row.licenseNumber})`,
  });

  revalidateCoach(created.id, [row.clubId]);
  redirect(`/registry/pelatih/${created.id}`);
}

export async function updateCoach(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await actionUser("registry:write");
  const before = await db.query.coaches.findFirst({ where: eq(coaches.id, id) });
  if (!before) return { error: "Pelatih tidak ditemukan." };

  const parsed = coachSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await licenseTaken(row.licenseNumber, id);
  if (taken) return formError({ licenseNumber: taken }, formData);

  await db.update(coaches).set(row).where(eq(coaches.id, id));
  // a replaced or removed scan / photo no longer needs its stored file
  await Promise.all([
    releaseReplaced(before.photoUrl, row.photoUrl),
    ...COACH_DOCUMENT_KEYS.map((k) => releaseReplaced(before[k], row[k])),
  ]);

  const changed = (Object.keys(row) as (keyof typeof row)[]).filter(
    (k) => (before[k] ?? null) !== (row[k] ?? null),
  );
  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "coach.update",
    entityType: "coach",
    entityId: id,
    summary: `Data pelatih ${row.fullName} diperbarui${changedSuffix(changed)}`,
    // documents are private: record that they changed, never the file ids
    before: Object.fromEntries(changed.filter((k) => !COACH_DOCUMENT_KEYS.includes(k as never)).map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.filter((k) => !COACH_DOCUMENT_KEYS.includes(k as never)).map((k) => [k, row[k]])),
  });

  revalidateCoach(id, [before.clubId, row.clubId]);
  redirect(`/registry/pelatih/${id}`);
}
