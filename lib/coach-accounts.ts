import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";
import { db } from "@/lib/db";
import type { TFunction } from "@/lib/i18n/translate";
import { coaches, users } from "@/lib/db/schema";
import { getSafeT } from "@/lib/i18n/server";

export const makeCoachAccountSchema = (t: TFunction) => z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
  password: z.string().max(72).refine((s) => !s || (s.length >= 8 && new TextEncoder().encode(s).length <= 72), t("Kata sandi minimal 8 karakter, maksimal 72 byte")),
  active: z.boolean(),
});

export type CoachAccountInput = z.infer<ReturnType<typeof makeCoachAccountSchema>>;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Creates or updates the login of one coach inside the caller's transaction, so a form that
 * registers a coach and their login together either saves both or neither. The coach's primary SSB
 * becomes the account's SSB. `passwordHash` is required for a new account and optional afterwards.
 */
export async function applyCoachAccount(tx: Tx, coachId: string, v: CoachAccountInput, passwordHash: string | undefined, t: TFunction) {
  const [coach] = await tx.select().from(coaches).where(eq(coaches.id, coachId)).for("update");
  if (!coach) throw new Error(t("Pelatih tidak ditemukan."));
  if (!coach.clubId) throw new Error(t("Tentukan SSB pelatih sebelum membuat akun login."));
  const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, v.email));
  if (existing && existing.id !== coach.userId) throw new Error(t("Email sudah terdaftar."));
  const id = coach.userId ?? crypto.randomUUID();
  const fields = { name: coach.fullName, email: v.email, clubId: coach.clubId, role: "coach" as const, active: v.active };
  if (coach.userId) {
    const [account] = await tx.select({ role: users.role }).from(users).where(eq(users.id, coach.userId));
    if (account?.role !== "coach") throw new Error(t("Akun yang terhubung bukan akun pelatih."));
    await tx.update(users).set({ ...fields, ...(passwordHash ? { passwordHash } : {}) }).where(eq(users.id, id));
  } else {
    if (!passwordHash) throw new Error(t("Kata sandi wajib diisi untuk akun baru."));
    await tx.insert(users).values({ id, ...fields, passwordHash });
    await tx.update(coaches).set({ userId: id }).where(eq(coaches.id, coachId));
  }
  return { id, ...fields, passwordChanged: !!passwordHash };
}

/** MariaDB's duplicate-key error, as thrown by the driver (directly or wrapped by drizzle). */
export function isDuplicateEntry(e: unknown) {
  const error = e as { code?: string; cause?: { code?: string } };
  return error.code === "ER_DUP_ENTRY" || error.cause?.code === "ER_DUP_ENTRY";
}

export async function saveCoachAccount(coachId: string, input: CoachAccountInput) {
  const t = await getSafeT();
  const v = makeCoachAccountSchema(t).parse(input);
  const passwordHash = v.password ? await hashPassword(v.password) : undefined;
  try {
    return await db.transaction((tx) => applyCoachAccount(tx, coachId, v, passwordHash, t));
  } catch (e) {
    if (isDuplicateEntry(e)) throw new Error(t("Email sudah terdaftar."));
    throw e;
  }
}
