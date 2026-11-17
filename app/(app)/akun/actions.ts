"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { PASSWORD_MAX_BYTES, hashPassword, verifyPassword } from "@/lib/auth/password";
import { FailureLimiter } from "@/lib/security/rate-limit";
import { auditText, recordAudit } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";

export type PasswordState = { error?: string; fieldErrors?: Record<string, string>; done?: boolean } | undefined;

/**
 * A wrong "current password" counts as a failure, so a stolen session cannot be used to guess the
 * password: 5 failures per 15 minutes per account. In-memory, like the login limiter (see
 * lib/security/rate-limit.ts for its limits). Kept across dev hot reloads.
 */
const globalForGuard = globalThis as unknown as { passwordChangeGuard?: FailureLimiter };
const guard = (globalForGuard.passwordChangeGuard ??= new FailureLimiter({ limit: 5, windowMs: 15 * 60 * 1000 }));

/** Any signed-in person changes their own password; it asks for the current one first. */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const t = await getT();
  const user = await actionUser();

  const wait = guard.blockedFor(user.id);
  if (wait > 0) return { error: t("Terlalu banyak percobaan. Coba lagi dalam {minutes} menit.", { minutes: Math.max(1, Math.ceil(wait / 60)) }) };

  const parsed = z
    .object({
      currentPassword: z.string().min(1, t("Isi kata sandi saat ini.")).max(1024),
      newPassword: z
        .string()
        .min(8, t("Kata sandi minimal 8 karakter"))
        .refine((s) => new TextEncoder().encode(s).length <= PASSWORD_MAX_BYTES, t("Kata sandi maksimal 72 byte")),
      confirmPassword: z.string(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("Periksa kembali isian formulir."), fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) return { error: t("Periksa kembali isian formulir."), fieldErrors: { confirmPassword: t("Kata sandi baru tidak sama.") } };

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!(await verifyPassword(currentPassword, row?.passwordHash))) {
    guard.hit(user.id);
    return { error: t("Periksa kembali isian formulir."), fieldErrors: { currentPassword: t("Kata sandi saat ini tidak sesuai.") } };
  }
  if (newPassword === currentPassword) return { error: t("Periksa kembali isian formulir."), fieldErrors: { newPassword: t("Kata sandi baru harus berbeda dari yang lama.") } };

  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, user.id));
  guard.reset(user.id);
  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "user.password",
    entityType: "user",
    entityId: user.id,
    summary: auditText("Kata sandi akun diganti oleh pemiliknya"),
  });
  return { done: true };
}
