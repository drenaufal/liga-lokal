"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { players, playerStats } from "@/lib/db/schema";
import { actionUser, actionUserAny } from "@/lib/auth/session";
import { auditText, changedSuffix, recordAudit } from "@/lib/audit";
import { documentUrlField, imageUrlField } from "@/lib/media";
import { releaseReplaced } from "@/lib/media-store";
import { optionalInt, formError, type FormState } from "@/lib/form";
import { insertReturning } from "@/lib/db/returning";
import { PLAYER_POSITIONS } from "@/lib/positions";
import { duplicateKeyOf, nextRegistrationNumbers } from "@/lib/registration";
import { DOCUMENT_KEYS } from "@/lib/player-documents";
import type { TFunction } from "@/lib/i18n/translate";
import { getT } from "@/lib/i18n/server";

const VERIF = ["verified", "flagged", "pending", "rejected"] as const;

export async function setVerification(formData: FormData) {
  const t = await getT();
  const user = await actionUser("registry.player:verify");
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as (typeof VERIF)[number];
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!VERIF.includes(status)) throw new Error(t("Status tidak valid"));

  const before = await db.query.players.findFirst({ where: eq(players.id, id) });

  await db
    .update(players)
    .set({
      verificationStatus: status,
      verificationNotes: notes,
      verifiedBy: status === "verified" ? user.id : null,
      verifiedAt: status === "verified" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(players.id, id));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: status === "verified" ? "player.verify" : status === "flagged" ? "player.flag" : "player.status",
    entityType: "player",
    entityId: id,
    summary: auditText('Status verifikasi pemain {name} diubah menjadi "{status}"', { name: before?.fullName ?? "", status }),
    before: { verificationStatus: before?.verificationStatus },
    after: { verificationStatus: status },
  });

  revalidatePath(`/registry/pemain/${id}`);
  revalidatePath("/registry/pemain");
  revalidatePath("/command-center");
}

const makePlayerSchema = (t: TFunction) =>
  z
  .object({
    fullName: z.string().trim().min(3, t("Nama minimal 3 karakter")),
    nickname: z.string().trim().optional(),
    nisn: z
      .string()
      .trim()
      .regex(/^\d{10}$/, t("NISN wajib diisi — 10 digit angka")),
    dob: z.string().min(1, t("Tanggal lahir wajib diisi")),
    birthPlace: z.string().trim().optional(),
    position: z.enum(PLAYER_POSITIONS, t("Pilih posisi")),
    foot: z.enum(["left", "right", "both"], t("Pilih kaki dominan")).default("right"),
    jerseyNumber: optionalInt(1, 99, t("Nomor punggung 1–99")),
    heightCm: optionalInt(90, 220, t("Tinggi 90–220 cm")),
    weightKg: optionalInt(20, 150, t("Berat 20–150 kg")),
    clubId: z.string().optional(),
    secondClubId: z.string().optional(),
    ageCategoryId: z.string().optional(),
    photoUrl: imageUrlField(t),
    kiaUrl: documentUrlField(t),
    kkUrl: documentUrlField(t),
    aktaUrl: documentUrlField(t),
    ijazahUrl: documentUrlField(t),
    raporUrl: documentUrlField(t),
    guardianName: z.string().trim().optional(),
    guardianPhone: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.secondClubId && !v.clubId)
      ctx.addIssue({ code: "custom", path: ["secondClubId"], message: t("Pilih klub utama terlebih dahulu") });
    else if (v.secondClubId && v.secondClubId === v.clubId)
      ctx.addIssue({ code: "custom", path: ["secondClubId"], message: t("Klub kedua harus berbeda dari klub utama") });
  });

type PlayerInput = z.infer<ReturnType<typeof makePlayerSchema>>;

function toRow(v: PlayerInput) {
  return {
    fullName: v.fullName,
    nickname: v.nickname || null,
    nisn: v.nisn,
    dob: v.dob,
    birthPlace: v.birthPlace || null,
    position: v.position,
    foot: v.foot,
    jerseyNumber: v.jerseyNumber ?? null,
    heightCm: v.heightCm ?? null,
    weightKg: v.weightKg ?? null,
    clubId: v.clubId || null,
    secondClubId: v.secondClubId || null,
    ageCategoryId: v.ageCategoryId || null,
    photoUrl: v.photoUrl || null,
    kiaUrl: v.kiaUrl || null,
    kkUrl: v.kkUrl || null,
    aktaUrl: v.aktaUrl || null,
    ijazahUrl: v.ijazahUrl || null,
    raporUrl: v.raporUrl || null,
    guardianName: v.guardianName || null,
    guardianPhone: v.guardianPhone || null,
  };
}

/** NISN is unique per player — report a friendly field error instead of a DB constraint error. */
async function nisnTaken(t: TFunction, nisn: string | null, exceptId?: string) {
  if (!nisn) return null;
  const hit = await db.query.players.findFirst({
    where: exceptId
      ? and(eq(players.nisn, nisn), ne(players.id, exceptId))
      : eq(players.nisn, nisn),
    columns: { fullName: true, registrationNo: true },
  });
  return hit ? t("NISN sudah terdaftar atas nama {name} ({reg})", { name: hit.fullName, reg: hit.registrationNo }) : null;
}

/** Two requests can pass the check above together; the unique index then rejects the second. */
function isDuplicateNisn(e: unknown) {
  return duplicateKeyOf(e)?.includes("nisn") ?? false;
}

/** Live check while typing the NISN in the form. */
export async function checkNisn(nisn: string, exceptId?: string) {
  const t = await getT();
  await actionUserAny(["registry.player:create", "registry.player:edit"]);
  if (!/^\d{10}$/.test(nisn)) return { ok: false as const, message: t("NISN harus 10 digit angka") };
  const taken = await nisnTaken(t, nisn, exceptId);
  return taken ? { ok: false as const, message: taken } : { ok: true as const };
}

export type PlayerFormState = FormState;

export async function createPlayer(
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const t = await getT();
  const user = await actionUser("registry.player:create");
  const parsed = makePlayerSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await nisnTaken(t, row.nisn);
  if (taken) return formError(t, { nisn: taken }, formData);

  // The registration number comes from the highest one in use; if another request
  // takes it first, ask again.
  let created: Awaited<ReturnType<typeof insertReturning<typeof players>>>[number] | undefined;
  let regNo = "";
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    [regNo] = await nextRegistrationNumbers(1);
    try {
      [created] = await insertReturning(db, players, { ...row, registrationNo: regNo, verificationStatus: "pending" });
    } catch (e) {
      if (isDuplicateNisn(e)) return formError(t, { nisn: t("NISN sudah terdaftar atas nama pemain lain") }, formData);
      if (!duplicateKeyOf(e)?.includes("registration_no")) throw e;
    }
  }
  if (!created) return { error: t("Gagal membuat nomor registrasi. Coba lagi.") };

  await db.insert(playerStats).values({
    playerId: created.id,
    tournamentId: null,
    season: "career",
    appearances: 0,
  });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "player.create",
    entityType: "player",
    entityId: created.id,
    summary: auditText("Registrasi pemain baru: {name} ({regNo})", { name: created.fullName, regNo }),
  });

  revalidatePath("/registry/pemain");
  redirect(`/registry/pemain/${created.id}`);
}

export async function updatePlayer(
  id: string,
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const t = await getT();
  const user = await actionUser("registry.player:edit");
  const before = await db.query.players.findFirst({ where: eq(players.id, id) });
  if (!before) return { error: t("Pemain tidak ditemukan.") };

  const parsed = makePlayerSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await nisnTaken(t, row.nisn, id);
  if (taken) return formError(t, { nisn: taken }, formData);

  try {
    await db
      .update(players)
      .set({ ...row, updatedAt: new Date() })
      .where(eq(players.id, id));
  } catch (e) {
    if (isDuplicateNisn(e)) return formError(t, { nisn: t("NISN sudah terdaftar atas nama pemain lain") }, formData);
    throw e;
  }

  // Free uploads that were replaced or removed.
  await Promise.all([
    releaseReplaced(before.photoUrl, row.photoUrl),
    ...DOCUMENT_KEYS.map((k) => releaseReplaced(before[k], row[k])),
  ]);

  const changed = (Object.keys(row) as (keyof typeof row)[]).filter(
    (k) => (before[k] ?? null) !== (row[k] ?? null),
  );

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "player.update",
    entityType: "player",
    entityId: id,
    summary: auditText("Data pemain {name} diperbarui{changed}", { name: row.fullName, changed: changedSuffix(changed) }),
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, row[k]])),
  });

  revalidatePath(`/registry/pemain/${id}`);
  revalidatePath("/registry/pemain");
  redirect(`/registry/pemain/${id}`);
}
