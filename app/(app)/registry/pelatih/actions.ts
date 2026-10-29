"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clubs, coaches, users } from "@/lib/db/schema";
import { applyCoachAccount, isDuplicateEntry, makeCoachAccountSchema, saveCoachAccount, type CoachAccountInput } from "@/lib/coach-accounts";
import { hashPassword } from "@/lib/auth/password";
import { can } from "@/lib/auth/rbac";
import { actionUser } from "@/lib/auth/session";
import { auditText, changedSuffix, recordAudit } from "@/lib/audit";
import { documentUrlField, imageUrlField } from "@/lib/media";
import { releaseReplaced } from "@/lib/media-store";
import { COACH_DOCUMENT_KEYS } from "@/lib/coach-documents";
import { formError, type FormState } from "@/lib/form";
import { COACH_LICENSE_LEVELS, COACH_SPECIALTIES } from "@/lib/status";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

const optionalDate = (t: TFunction) =>
  z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), t("Tanggal tidak valid"))
    .optional();

const makeCoachSchema = (t: TFunction) => z.object({
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter"),
  dob: optionalDate(t),
  city: z.string().trim().optional(),
  clubId: z.string().optional(),
  /** A coach may look after a second SSB (two at most). */
  secondClubId: z.string().optional(),
  specialty: z
    .string()
    .refine((v) => v === "" || COACH_SPECIALTIES.includes(v), t("Peran tidak dikenali"))
    .optional(),
  licenseLevel: z
    .string()
    .refine((v) => COACH_LICENSE_LEVELS.includes(v), t("Pilih tingkat lisensi")),
  licenseNumber: z.string().trim().toUpperCase().min(3, t("Nomor lisensi wajib diisi")).max(40),
  licenseDocUrl: documentUrlField(t),
  ktpUrl: documentUrlField(t),
  photoUrl: imageUrlField(t),
  phone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email("Email tidak valid")]).optional(),
  /** Registration form only: the coach's login, created together with the profile. */
  accountEmail: z.string().trim().toLowerCase().optional(),
  accountPassword: z.string().optional(),
});

type CoachInput = z.infer<ReturnType<typeof makeCoachSchema>>;

function toRow(v: CoachInput) {
  return {
    fullName: v.fullName,
    dob: v.dob || null,
    city: v.city || null,
    clubId: v.clubId || null,
    secondClubId: v.secondClubId || null,
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

async function licenseTaken(t: TFunction, licenseNumber: string, exceptId?: string) {
  const hit = await db.query.coaches.findFirst({
    where: exceptId
      ? and(eq(coaches.licenseNumber, licenseNumber), ne(coaches.id, exceptId))
      : eq(coaches.licenseNumber, licenseNumber),
    columns: { fullName: true },
  });
  return hit ? t("Nomor lisensi sudah terdaftar atas nama {name}", { name: hit.fullName }) : null;
}

/** The SSB assignment: a second SSB needs a primary one, must differ from it, and both must exist. */
async function assignmentErrors(t: TFunction, row: Pick<ReturnType<typeof toRow>, "clubId" | "secondClubId">) {
  const errors: Record<string, string> = {};
  if (row.secondClubId && !row.clubId) errors.secondClubId = t("Tentukan SSB utama sebelum SSB kedua.");
  else if (row.secondClubId && row.secondClubId === row.clubId) errors.secondClubId = t("SSB kedua tidak boleh sama dengan SSB utama.");
  const ids = [row.clubId, row.secondClubId].filter((id): id is string => !!id);
  if (ids.length) {
    const found = new Set((await db.select({ id: clubs.id }).from(clubs).where(inArray(clubs.id, ids))).map((c) => c.id));
    if (row.clubId && !found.has(row.clubId)) errors.clubId = t("SSB tidak ditemukan.");
    if (row.secondClubId && !found.has(row.secondClubId)) errors.secondClubId ??= t("SSB tidak ditemukan.");
  }
  return errors;
}

function revalidateCoach(id: string, clubIds: (string | null)[]) {
  revalidatePath("/registry/pelatih");
  revalidatePath(`/registry/pelatih/${id}`);
  for (const c of new Set(clubIds)) if (c) revalidatePath(`/registry/klub/${c}`);
}

export async function createCoach(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const user = await actionUser("registry.coach:create");
  const parsed = makeCoachSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await licenseTaken(t, row.licenseNumber);
  if (taken) return formError(t, { licenseNumber: taken }, formData);
  const assignment = await assignmentErrors(t, row);
  if (Object.keys(assignment).length) return formError(t, assignment, formData);

  // The login (optional) is checked before anything is saved, then saved together with the profile.
  const { accountEmail, accountPassword } = parsed.data;
  let login: CoachAccountInput | null = null;
  if (accountEmail || accountPassword) {
    if (!can(user, "registry.coach:account")) return formError(t, { accountEmail: t("Akses ditolak untuk tindakan ini.") }, formData);
    const account = makeCoachAccountSchema(t).safeParse({ email: accountEmail ?? "", password: accountPassword ?? "", active: true });
    if (!account.success)
      return formError(t, Object.fromEntries(account.error.issues.map((i) => [i.path[0] === "email" ? "accountEmail" : "accountPassword", i.message])), formData);
    if (!account.data.password) return formError(t, { accountPassword: t("Kata sandi wajib diisi untuk akun baru.") }, formData);
    if (!row.clubId) return formError(t, { clubId: t("Tentukan SSB pelatih sebelum membuat akun login.") }, formData);
    login = account.data;
  }
  const passwordHash = login ? await hashPassword(login.password) : undefined;

  const id = crypto.randomUUID();
  let account: Awaited<ReturnType<typeof applyCoachAccount>> | null = null;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(coaches).values({ id, ...row });
      if (login) account = await applyCoachAccount(tx, id, login, passwordHash, t);
    });
  } catch (e) {
    if (login && (isDuplicateEntry(e) || (e instanceof Error && e.message === t("Email sudah terdaftar."))))
      return formError(t, { accountEmail: t("Email sudah terdaftar.") }, formData);
    throw e;
  }

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "coach.create",
    entityType: "coach",
    entityId: id,
    summary: auditText("Registrasi pelatih baru: {name} ({level} · {number})", { name: row.fullName, level: row.licenseLevel, number: row.licenseNumber }),
  });
  if (account) {
    const created = account as Awaited<ReturnType<typeof applyCoachAccount>>;
    await recordAudit({ actorId: user.id, actorName: user.name, actorRole: user.role, action: "coach.account", entityType: "user", entityId: created.id,
      summary: auditText("Akun login pelatih disimpan: {name}", { name: created.name }), after: { ...created } });
    revalidatePath("/dsp");
  }

  revalidateCoach(id, [row.clubId, row.secondClubId]);
  redirect(`/registry/pelatih/${id}`);
}

export async function updateCoach(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const user = await actionUser("registry.coach:edit");
  const before = await db.query.coaches.findFirst({ where: eq(coaches.id, id) });
  if (!before) return { error: t("Pelatih tidak ditemukan.") };

  const parsed = makeCoachSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await licenseTaken(t, row.licenseNumber, id);
  if (taken) return formError(t, { licenseNumber: taken }, formData);
  const assignment = await assignmentErrors(t, row);
  if (Object.keys(assignment).length) return formError(t, assignment, formData);

  await db.transaction(async (tx) => {
    await tx.update(coaches).set(row).where(eq(coaches.id, id));
    if (before.userId) await tx.update(users).set({ name: row.fullName, clubId: row.clubId }).where(and(eq(users.id, before.userId), eq(users.role, "coach")));
  });
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
    summary: auditText("Data pelatih {name} diperbarui{changed}", { name: row.fullName, changed: changedSuffix(changed) }),
    // documents are private: record that they changed, never the file ids
    before: Object.fromEntries(changed.filter((k) => !COACH_DOCUMENT_KEYS.includes(k as never)).map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.filter((k) => !COACH_DOCUMENT_KEYS.includes(k as never)).map((k) => [k, row[k]])),
  });

  revalidateCoach(id, [before.clubId, before.secondClubId, row.clubId, row.secondClubId]);
  redirect(`/registry/pelatih/${id}`);
}

export async function saveCoachLogin(coachId: string, input: CoachAccountInput) {
  const actor = await actionUser("registry.coach:account");
  const account = await saveCoachAccount(coachId, input);
  await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "coach.account", entityType: "user", entityId: account.id,
    summary: auditText("Akun login pelatih disimpan: {name}", { name: account.name }), after: account });
  revalidatePath(`/registry/pelatih/${coachId}`);
  revalidatePath("/dsp");
}
