/**
 * Guards for the local-development scripts (db:seed, db:reset, db:seed:dsp, db:copy-from-neon).
 *
 * Two different risks, two different switches:
 *  - assertDemoSeedAllowed: the seed creates accounts that share the public password in
 *    lib/demo-accounts.ts. Refused when NODE_ENV/APP_ENV is "production" unless ALLOW_DEMO_SEED=1.
 *    (Even then, that password can never sign in on a production server — see lib/auth/credentials.ts.)
 *  - assertSafeToWipe: TRUNCATE-ing every table. Refused for a production environment or any
 *    database that is not on this machine unless ALLOW_DB_WIPE=1.
 *
 * Real production accounts are created with `npm run db:seed:super`, which is not blocked.
 */
type Env = Record<string, string | undefined>;

const isProductionEnv = (env: Env) => env.NODE_ENV === "production" || env.APP_ENV === "production";
const flag = (v: string | undefined) => v === "1" || v === "true";

export function isLocalDatabase(uri: string | undefined) {
  if (!uri) return false;
  try {
    const host = new URL(uri).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "::1" ||
      host === "[::1]" ||
      host === "host.docker.internal" ||
      host.endsWith(".localhost") ||
      /^127(\.\d{1,3}){3}$/.test(host)
    );
  } catch {
    return false;
  }
}

export function demoSeedBlocker(env: Env = process.env): string | null {
  if (isProductionEnv(env) && !flag(env.ALLOW_DEMO_SEED)) {
    return "Refusing to create the demo accounts: NODE_ENV/APP_ENV is \"production\". These accounts share a public password. Create real accounts with `npm run db:seed:super` instead (or set ALLOW_DEMO_SEED=1 for a throwaway staging copy).";
  }
  return null;
}

export function wipeBlocker(uri: string | undefined, env: Env = process.env): string | null {
  if (flag(env.ALLOW_DB_WIPE)) return null;
  if (isProductionEnv(env)) {
    return "Refusing to empty the database: NODE_ENV/APP_ENV is \"production\". Set ALLOW_DB_WIPE=1 only if you really mean it.";
  }
  if (!isLocalDatabase(uri)) {
    return "Refusing to empty a database that is not on this machine (host is not localhost/127.0.0.1). Set ALLOW_DB_WIPE=1 only if you really mean it.";
  }
  return null;
}

export function assertDemoSeedAllowed(env: Env = process.env) {
  const problem = demoSeedBlocker(env);
  if (problem) throw new Error(problem);
}

export function assertSafeToWipe(uri: string | undefined, env: Env = process.env) {
  const problem = wipeBlocker(uri, env);
  if (problem) throw new Error(problem);
}
