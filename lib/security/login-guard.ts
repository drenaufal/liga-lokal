import { FailureLimiter } from "./rate-limit";
import { UNKNOWN_IP } from "./client-ip";

/**
 * Brute-force policy for the credentials login, applied inside `authorize()` so it covers both
 * the login server action and a direct POST to /api/auth/callback/credentials.
 *
 * Three counters, all fed by FAILED attempts only and all reported to the user the same way
 * (so an unknown email behaves exactly like a known one):
 *   - sign-in source + email: 5 failures / 15 min  → stops guessing one account from one place
 *   - sign-in source:        20 failures / 15 min  → stops one place spraying many accounts
 *   - email, any source:     30 failures / 15 min  → caps a distributed attack on one account
 *     while keeping the account-lockout lever for an outsider high (a victim is not locked out
 *     by five wrong guesses from elsewhere — they only lose the attacker's own source).
 * A successful sign-in clears only the source+email counter.
 *
 * In-memory — see the limits in ./rate-limit.ts.
 */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMITS = { pair: 5, ip: 20, email: 30 } as const;

export type LoginGate = { allowed: true } | { allowed: false; retryAfterSec: number };

export function normalizeEmailKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

export function createLoginGuard(now: () => number = Date.now) {
  const pair = new FailureLimiter({ limit: LOGIN_LIMITS.pair, windowMs: LOGIN_WINDOW_MS }, now);
  const ip = new FailureLimiter({ limit: LOGIN_LIMITS.ip, windowMs: LOGIN_WINDOW_MS }, now);
  const email = new FailureLimiter({ limit: LOGIN_LIMITS.email, windowMs: LOGIN_WINDOW_MS }, now);
  const pairKey = (addr: string, mail: string) => `${addr}|${mail}`;

  return {
    check(addr: string, rawEmail: unknown): LoginGate {
      const mail = normalizeEmailKey(rawEmail);
      const waits = [
        pair.blockedFor(pairKey(addr, mail)),
        addr === UNKNOWN_IP ? 0 : ip.blockedFor(addr),
        mail ? email.blockedFor(mail) : 0,
      ];
      const retryAfterSec = Math.max(...waits);
      return retryAfterSec > 0 ? { allowed: false, retryAfterSec } : { allowed: true };
    },
    failure(addr: string, rawEmail: unknown) {
      const mail = normalizeEmailKey(rawEmail);
      pair.hit(pairKey(addr, mail));
      if (addr !== UNKNOWN_IP) ip.hit(addr);
      if (mail) email.hit(mail);
    },
    success(addr: string, rawEmail: unknown) {
      pair.reset(pairKey(addr, normalizeEmailKey(rawEmail)));
    },
  };
}

// One guard per process, kept across dev hot reloads.
const globalForGuard = globalThis as unknown as { loginGuard?: ReturnType<typeof createLoginGuard> };
export const loginGuard = (globalForGuard.loginGuard ??= createLoginGuard());
