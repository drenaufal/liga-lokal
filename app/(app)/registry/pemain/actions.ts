"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { players, playerStats } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { changedSuffix, recordAudit } from "@/lib/audit";
import { documentUrlField, imageUrlField } from "@/lib/media";
import { releaseReplaced } from "@/lib/media-store";
import { optionalInt, formError, type FormState } from "@/lib/form";
import { insertReturning } from "@/lib/db/returning";
import { PLAYER_POSITIONS } from "@/lib/positions";
import { duplicateKeyOf, nextRegistrationNumbers } from "@/lib/registration";
import { DOCUMENT_KEYS } from "@/lib/player-documents";

const VERIF = ["verified", "flagged", "pending", "rejected"] as const;

export async function setVerification(formData: FormData) {
  const user = await actionUser("registry:verify");
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as (typeof VERIF)[number];
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!VERIF.includes(status)) throw new Error("Status tidak valid");

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
    summary: `Status verifikasi pemain ${before?.fullName ?? ""} diubah menjadi "${status}"`,
    before: { verificationStatus: before?.verificationStatus },
    after: { verificationStatus: status },
  });

  revalidatePath(`/registry/pemain/${id}`);
  revalidatePath("/registry/pemain");
  revalidatePath("/command-center");
}

const playerSchema = z
  .object({
    fullName: z.string().trim().min(3, "Nama minimal 3 karakter"),
    nickname: z.string().trim().optional(),
    nisn: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "NISN wajib diisi — 10 digit angka"),
    dob: z.string().min(1, "Tanggal lahir wajib diisi"),
    birthPlace: z.string().trim().optional(),
    position: z.enum(PLAYER_POSITIONS, "Pilih posisi"),
    foot: z.enum(["left", "right", "both"], "Pilih kaki dominan").default("right"),
    jerseyNumber: optionalInt(1, 99, "Nomor punggung 1–99"),
    heightCm: optionalInt(90, 220, "Tinggi 90–220 cm"),
    weightKg: optionalInt(20, 150, "Berat 20–150 kg"),
    clubId: z.string().optional(),
    secondClubId: z.string().optional(),
    ageCategoryId: z.string().optional(),
    photoUrl: imageUrlField,
    kiaUrl: documentUrlField,
    kkUrl: documentUrlField,
    aktaUrl: documentUrlField,
    ijazahUrl: documentUrlField,
    raporUrl: documentUrlField,
    guardianName: z.string().trim().optional(),
    guardianPhone: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.secondClubId && !v.clubId)
      ctx.addIssue({ code: "custom", path: ["secondClubId"], message: "Pilih klub utama terlebih dahulu" });
    else if (v.secondClubId && v.secondClubId === v.clubId)
      ctx.addIssue({ code: "custom", path: ["secondClubId"], message: "Klub kedua harus berbeda dari klub utama" });
  });

type PlayerInput = z.infer<typeof playerSchema>;

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
async function nisnTaken(nisn: string | null, exceptId?: string) {
  if (!nisn) return null;
  const hit = await db.query.players.findFirst({
    where: exceptId
      ? and(eq(players.nisn, nisn), ne(players.id, exceptId))
      : eq(players.nisn, nisn),
    columns: { fullName: true, registrationNo: true },
  });
  return hit ? `NISN sudah terdaftar atas nama ${hit.fullName} (${hit.registrationNo})` : null;
}

/** Two requests can pass the check above together; the unique index then rejects the second. */
function isDuplicateNisn(e: unknown) {
  return duplicateKeyOf(e)?.includes("nisn") ?? false;
}

/** Live check while typing the NISN in the form. */
export async function checkNisn(nisn: string, exceptId?: string) {
  await actionUser("registry:write");
  if (!/^\d{10}$/.test(nisn)) return { ok: false as const, message: "NISN harus 10 digit angka" };
  const taken = await nisnTaken(nisn, exceptId);
  return taken ? { ok: false as const, message: taken } : { ok: true as const };
}

export type PlayerFormState = FormState;

export async function createPlayer(
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const user = await actionUser("registry:write");
  const parsed = playerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await nisnTaken(row.nisn);
  if (taken) return formError({ nisn: taken }, formData);

  // The registration number comes from the highest one in use; if another request
  // takes it first, ask again.
  let created: Awaited<ReturnType<typeof insertReturning<typeof players>>>[number] | undefined;
  let regNo = "";
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    [regNo] = await nextRegistrationNumbers(1);
    try {
      [created] = await insertReturning(db, players, { ...row, registrationNo: regNo, verificationStatus: "pending" });
    } catch (e) {
      if (isDuplicateNisn(e)) return formError({ nisn: "NISN sudah terdaftar atas nama pemain lain" }, formData);
      if (!duplicateKeyOf(e)?.includes("registration_no")) throw e;
    }
  }
  if (!created) return { error: "Gagal membuat nomor registrasi. Coba lagi." };

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
    summary: `Registrasi pemain baru: ${created.fullName} (${regNo})`,
  });

  revalidatePath("/registry/pemain");
  redirect(`/registry/pemain/${created.id}`);
}

export async function updatePlayer(
  id: string,
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const user = await actionUser("registry:write");
  const before = await db.query.players.findFirst({ where: eq(players.id, id) });
  if (!before) return { error: "Pemain tidak ditemukan." };

  const parsed = playerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await nisnTaken(row.nisn, id);
  if (taken) return formError({ nisn: taken }, formData);

  try {
    await db
      .update(players)
      .set({ ...row, updatedAt: new Date() })
      .where(eq(players.id, id));
  } catch (e) {
    if (isDuplicateNisn(e)) return formError({ nisn: "NISN sudah terdaftar atas nama pemain lain" }, formData);
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
    summary: `Data pemain ${row.fullName} diperbarui${changedSuffix(changed)}`,
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, row[k]])),
  });

  revalidatePath(`/registry/pemain/${id}`);
  revalidatePath("/registry/pemain");
  redirect(`/registry/pemain/${id}`);
}
