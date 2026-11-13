/**
 * Minimal in-memory failure counter used to slow down password guessing.
 *
 * LIMITS (read before relying on it):
 *  - State lives in this Node process only. A restart clears it, and with several instances
 *    (or serverless functions) each one counts separately, so the effective limit is
 *    `limit × instances`. For a multi-instance deployment swap the Map for Redis/Upstash/a DB
 *    table behind the same three methods.
 *  - Memory is bounded (`maxKeys`): when full, expired entries go first, then the oldest.
 */
export type LimiterOptions = {
  /** Failures allowed inside one window before the key is blocked. */
  limit: number;
  windowMs: number;
  maxKeys?: number;
};

type Entry = { count: number; resetAt: number };

export class FailureLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly options: LimiterOptions,
    private readonly now: () => number = Date.now,
  ) {}

  /** Seconds until `key` may try again, or 0 when it is not blocked. */
  blockedFor(key: string): number {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    const t = this.now();
    if (entry.resetAt <= t) {
      this.entries.delete(key);
      return 0;
    }
    return entry.count >= this.options.limit ? Math.ceil((entry.resetAt - t) / 1000) : 0;
  }

  /** Counts one failure. The window starts at the first failure and is not extended by later ones. */
  hit(key: string): void {
    const t = this.now();
    const entry = this.entries.get(key);
    if (entry && entry.resetAt > t) {
      entry.count += 1;
      return;
    }
    this.entries.delete(key); // re-insert so Map order stays oldest → newest
    this.entries.set(key, { count: 1, resetAt: t + this.options.windowMs });
    this.prune(t);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  get size() {
    return this.entries.size;
  }

  private prune(t: number) {
    const max = this.options.maxKeys ?? 10_000;
    if (this.entries.size <= max) return;
    for (const [k, e] of this.entries) if (e.resetAt <= t) this.entries.delete(k);
    for (const k of this.entries.keys()) {
      if (this.entries.size <= max) break;
      this.entries.delete(k);
    }
  }
}
