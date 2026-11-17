import { compare, getRounds, hash } from "bcryptjs";

/**
 * Work factor for every new password hash. bcrypt cost is exponential: 12 is roughly
 * 250 ms on a modern server core, which is slow enough to hurt offline guessing and
 * fast enough for a login. Raise it as hardware gets faster — existing hashes with a
 * lower cost are upgraded the next time their owner signs in (see `needsRehash`).
 */
export const BCRYPT_COST = 12;

/** bcrypt only reads the first 72 bytes, so longer passwords are rejected rather than silently truncated. */
export const PASSWORD_MAX_BYTES = 72;

export function hashPassword(plain: string) {
  return hash(plain, BCRYPT_COST);
}

/**
 * Hash used when the account does not exist (or is inactive). Comparing against it makes
 * "unknown email" cost the same bcrypt round as "wrong password", so response time does not
 * reveal which emails are registered. Generated once per process at the production cost.
 */
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hash(`dummy-${Math.random()}-${Date.now()}`, BCRYPT_COST);
  return dummyHash;
}

/** Constant-work password check: always runs one bcrypt compare, even when there is no stored hash. */
export async function verifyPassword(plain: string, storedHash: string | null | undefined) {
  const target = storedHash || (await getDummyHash());
  const ok = await compare(plain, target);
  return ok && !!storedHash;
}

/** True when a stored hash was made with a lower cost than the current policy. */
export function needsRehash(storedHash: string) {
  try {
    return getRounds(storedHash) < BCRYPT_COST;
  } catch {
    return false;
  }
}
