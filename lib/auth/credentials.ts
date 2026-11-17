import { CredentialsSignin } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";
import { needsRehash, hashPassword, verifyPassword, PASSWORD_MAX_BYTES } from "./password";
import { clientIpFromHeaders } from "@/lib/security/client-ip";
import { loginGuard } from "@/lib/security/login-guard";

const credsSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z
    .string()
    .min(1)
    .refine((s) => new TextEncoder().encode(s).length <= PASSWORD_MAX_BYTES),
});

/** Thrown by `authorize()` when the brute-force limiter blocks an attempt (surfaces as AuthError). */
export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
  constructor(readonly retryAfterSec: number) {
    super();
  }
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Shared login path for every account type. The caller only ever learns "ok" or "no":
 * unknown email, wrong password, inactive account and blocked demo password all return
 * `null` after the same bcrypt work, so neither the response nor its timing says which one it was.
 */
export async function authenticateCredentials(raw: unknown, request?: Request) {
  const ip = clientIpFromHeaders(request?.headers);
  const attemptedEmail = (raw as { email?: unknown } | null)?.email;

  const gate = loginGuard.check(ip, attemptedEmail);
  if (!gate.allowed) {
    console.warn(`[auth] login blocked by rate limit (source ${ip}, retry in ${gate.retryAfterSec}s)`);
    throw new LoginRateLimited(gate.retryAfterSec);
  }

  const parsed = credsSchema.safeParse(raw);
  if (!parsed.success) {
    loginGuard.failure(ip, attemptedEmail);
    return null;
  }
  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Always one bcrypt compare, even for an unknown email (compares against a throwaway hash).
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  // The password shipped with the seed data is public. Even if a seeded account somehow
  // reaches a production database, that password never signs anyone in.
  const demoPasswordBlocked = IS_PRODUCTION && password === DEMO_PASSWORD;

  if (!user || !user.active || !passwordOk || demoPasswordBlocked) {
    loginGuard.failure(ip, email);
    return null;
  }

  loginGuard.success(ip, email);

  // Upgrade older, cheaper hashes the first time their owner signs in. Never blocks the login.
  if (needsRehash(user.passwordHash)) {
    try {
      await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
    } catch (e) {
      console.warn("[auth] password hash upgrade skipped:", e instanceof Error ? e.message : "unknown error");
    }
  }

  return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, title: user.title, clubId: user.clubId };
}
