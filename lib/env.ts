/**
 * Production configuration check. Called when the server boots (instrumentation.ts) and again
 * when the auth module loads, so a misconfigured deployment fails immediately with a clear list
 * instead of running with a guessable session key. Messages name the variable, never its value.
 *
 * Skipped outside `NODE_ENV=production` and during `next build` (which also runs with
 * NODE_ENV=production but has no runtime secrets).
 */
const TRUTHY = new Set(["1", "true", "yes", "on"]);

export const envFlag = (value: string | undefined) => TRUTHY.has((value ?? "").trim().toLowerCase());

const WEAK_SECRET_HINTS = /change.?me|your[-_ ]?secret|replace|example|placeholder|password|secret123|ligalokal|footgrit|^(.)\1+$/i;

/** Returns what is wrong with an AUTH_SECRET, or `null` when it looks fine. */
export function authSecretProblem(secret: string | undefined): string | null {
  if (!secret) return "AUTH_SECRET is not set";
  if (secret.length < 32) return "AUTH_SECRET must be at least 32 characters (generate one with `openssl rand -base64 48`)";
  if (new Set(secret).size < 12) return "AUTH_SECRET has too little variety — use a random value (`openssl rand -base64 48`)";
  if (WEAK_SECRET_HINTS.test(secret)) return "AUTH_SECRET looks like a placeholder — use a random value (`openssl rand -base64 48`)";
  return null;
}

export function productionEnvProblems(env: Record<string, string | undefined> = process.env): string[] {
  const problems: string[] = [];

  const secret = authSecretProblem(env.AUTH_SECRET);
  if (secret) problems.push(secret);

  const authUrl = env.AUTH_URL;
  if (authUrl) {
    try {
      const u = new URL(authUrl);
      const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
      if (u.protocol !== "https:" && !local) problems.push("AUTH_URL must be an https:// URL in production");
    } catch {
      problems.push("AUTH_URL is not a valid URL");
    }
  } else if (!envFlag(env.AUTH_TRUST_HOST)) {
    problems.push("set AUTH_URL to the public https URL (pins the host Auth.js trusts) or, behind a proxy you control, AUTH_TRUST_HOST=true");
  }

  if (!env.DATABASE_URL) problems.push("DATABASE_URL is not set");

  return problems;
}

export function assertProductionEnv(env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV !== "production") return;
  if (env.NEXT_PHASE === "phase-production-build") return;

  const problems = productionEnvProblems(env);
  if (problems.length) {
    throw new Error(`Invalid production environment:\n${problems.map((p) => `  - ${p}`).join("\n")}\nSee .env.example.`);
  }

  warnAboutProxy(env);
}

/**
 * Boot-time wrapper: print the problems and stop the process, so the host shows a crashed app
 * instead of one that answers every request with a 500. Node runtime only (called from instrumentation.ts).
 */
export function exitOnInvalidProductionEnv(env: Record<string, string | undefined> = process.env) {
  try {
    assertProductionEnv(env);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

function warnAboutProxy(env: Record<string, string | undefined>) {
  if (!env.TRUSTED_PROXY_HOPS) {
    console.warn(
      "[security] TRUSTED_PROXY_HOPS is not set: login rate limiting counts per email only, not per client address. " +
        "Set it to the number of reverse proxies in front of the app (see .env.example).",
    );
  }
}
