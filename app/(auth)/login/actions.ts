"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { signIn } from "@/lib/auth";
import { LoginRateLimited } from "@/lib/auth/credentials";
import { landingFor, safeNextPath } from "@/lib/auth/redirect";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getT } from "@/lib/i18n/server";

/** `email` is echoed back on failure because React clears an action form once it settles. */
export type LoginState = { error?: string; email?: string } | undefined;

/** Generous upper bounds — real inputs are far shorter; this only stops absurd payloads reaching bcrypt/the DB. */
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const t = await getT();
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";
  // Only a same-origin relative path survives; "//evil.com", "https://…", "/\evil.com" become null.
  const next = safeNextPath(formData.get("next"));

  // One message for every failure that is not a rate-limit block, so the form never reveals
  // whether an email exists, is inactive, or just had the wrong password.
  const invalid = { error: t("Email atau kata sandi tidak sesuai."), email };
  if (!email || !password || email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) return invalid;

  try {
    // The brute-force limiter lives inside authorize() (lib/auth/credentials.ts), so it also
    // guards a direct POST to /api/auth/callback/credentials, not just this form.
    await signIn("credentials", { email, password, redirect: false, redirectTo: next ?? "/" });
  } catch (err) {
    if (err instanceof LoginRateLimited) {
      return {
        error: t("Terlalu banyak percobaan masuk. Coba lagi dalam {minutes} menit.", {
          minutes: Math.max(1, Math.ceil(err.retryAfterSec / 60)),
        }),
        email,
      };
    }
    if (err instanceof AuthError) return invalid;
    throw err;
  }

  // The landing page depends on the role, which is only looked up once the sign-in succeeded.
  const account = await db.query.users.findFirst({ where: eq(users.email, email), columns: { role: true } });
  redirect(next ?? landingFor(account?.role));
}
