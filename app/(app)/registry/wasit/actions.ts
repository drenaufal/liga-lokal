"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { referees } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { auditText, changedSuffix, recordAudit } from "@/lib/audit";
import { imageUrlField } from "@/lib/media";
import { releaseReplaced } from "@/lib/media-store";
import { formError, type FormState } from "@/lib/form";
import { REFEREE_LICENSE_LEVELS, REFEREE_SPECIALTIES, licenseStatus } from "@/lib/status";
import { insertReturning } from "@/lib/db/returning";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

const optionalDate = (t: TFunction) =>
  z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), t("Tanggal tidak valid"))
    .optional();

const makeRefereeSchema = (t: TFunction) => z
  .object({
    fullName: z.string().trim().min(3, "Nama minimal 3 karakter"),
    dob: optionalDate(t),
    city: z.string().trim().optional(),
    askot: z.string().trim().max(120, t("Askot maksimal 120 karakter")).optional(),
    specialty: z
      .string()
      .refine((v) => v === "" || REFEREE_SPECIALTIES.includes(v), t("Peran tidak dikenali"))
      .optional(),
    licenseLevel: z
      .string()
      .refine((v) => REFEREE_LICENSE_LEVELS.includes(v), t("Pilih tingkat lisensi")),
    licenseNumber: z.string().trim().toUpperCase().min(3, t("Nomor lisensi wajib diisi")).max(40),
    licenseIssuedAt: optionalDate(t),
    licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("Tanggal berlaku wajib diisi")),
    revoked: z.literal("on").optional(),
    photoUrl: imageUrlField(t),
    phone: z.string().trim().optional(),
    email: z.union([z.literal(""), z.email(t("Email tidak valid"))]).optional(),
  })
  .refine((v) => !v.licenseIssuedAt || v.licenseIssuedAt < v.licenseExpiry, {
    path: ["licenseExpiry"],
    message: t("Masa berlaku harus setelah tanggal terbit"),
  });

type RefereeInput = z.infer<ReturnType<typeof makeRefereeSchema>>;

function toRow(v: RefereeInput) {
  return {
    fullName: v.fullName,
    dob: v.dob || null,
    city: v.city || null,
    askot: v.askot || null,
    specialty: v.specialty || null,
    licenseLevel: v.licenseLevel,
    licenseNumber: v.licenseNumber,
    licenseIssuedAt: v.licenseIssuedAt || null,
    licenseExpiry: v.licenseExpiry,
    // stored for reference; lists and profiles derive the live status from the expiry date
    status: licenseStatus(v.licenseExpiry, v.revoked === "on"),
    photoUrl: v.photoUrl || null,
    phone: v.phone || null,
    email: v.email || null,
  };
}

async function licenseTaken(t: TFunction, licenseNumber: string, exceptId?: string) {
  const hit = await db.query.referees.findFirst({
    where: exceptId
      ? and(eq(referees.licenseNumber, licenseNumber), ne(referees.id, exceptId))
      : eq(referees.licenseNumber, licenseNumber),
    columns: { fullName: true },
  });
  return hit ? t("Nomor lisensi sudah terdaftar atas nama {name}", { name: hit.fullName }) : null;
}

export async function createReferee(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const user = await actionUser("registry.referee:create");
  const parsed = makeRefereeSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await licenseTaken(t, row.licenseNumber);
  if (taken) return formError(t, { licenseNumber: taken }, formData);

  const [created] = await insertReturning(db, referees, row);

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "referee.create",
    entityType: "referee",
    entityId: created.id,
    summary: auditText("Registrasi wasit baru: {name} ({level} · {number})", { name: row.fullName, level: row.licenseLevel, number: row.licenseNumber }),
  });

  revalidatePath("/registry/wasit");
  redirect(`/registry/wasit/${created.id}`);
}

export async function updateReferee(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const user = await actionUser("registry.referee:edit");
  const before = await db.query.referees.findFirst({ where: eq(referees.id, id) });
  if (!before) return { error: t("Wasit tidak ditemukan.") };

  const parsed = makeRefereeSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await licenseTaken(t, row.licenseNumber, id);
  if (taken) return formError(t, { licenseNumber: taken }, formData);

  await db.update(referees).set(row).where(eq(referees.id, id));
  await releaseReplaced(before.photoUrl, row.photoUrl);

  const changed = (Object.keys(row) as (keyof typeof row)[]).filter(
    (k) => (before[k] ?? null) !== (row[k] ?? null),
  );
  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: before.status !== "revoked" && row.status === "revoked" ? "referee.revoke" : "referee.update",
    entityType: "referee",
    entityId: id,
    summary: auditText("Data wasit {name} diperbarui{changed}", { name: row.fullName, changed: changedSuffix(changed) }),
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, row[k]])),
  });

  revalidatePath("/registry/wasit");
  revalidatePath(`/registry/wasit/${id}`);
  redirect(`/registry/wasit/${id}`);
}
