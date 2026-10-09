import type { PlayerStat } from "@/lib/db/schema";

/**
 * Counting stats that simply add up across tournaments / clubs. `score` is a
 * weighted sum of these, so it adds up too; `rating` is the exception and is
 * averaged by appearances.
 */
export const COUNTER_FIELDS = [
  "appearances",
  "minutesPlayed",
  "goals",
  "assists",
  "saves",
  "shotsOnTarget",
  "shotsOffTarget",
  "tackles",
  "interceptions",
  "keyPasses",
  "duelsWon",
  "cleanSheets",
  "yellowCards",
  "redCards",
  "foulsCommitted",
  "motm",
] as const;

export type StatTotals = Pick<PlayerStat, (typeof COUNTER_FIELDS)[number] | "rating" | "score">;

export function emptyTotals(): StatTotals {
  return {
    appearances: 0,
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    shotsOnTarget: 0,
    shotsOffTarget: 0,
    tackles: 0,
    interceptions: 0,
    keyPasses: 0,
    duelsWon: 0,
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0,
    foulsCommitted: 0,
    motm: 0,
    rating: 0,
    score: 0,
  };
}

/** Adds stat lines together — e.g. every tournament played for one club. */
export function sumStats(rows: StatTotals[]): StatTotals {
  const total = emptyTotals();
  let ratingWeight = 0;
  let ratingSum = 0;
  for (const r of rows) {
    for (const f of COUNTER_FIELDS) total[f] += r[f] ?? 0;
    total.score += r.score ?? 0;
    const w = r.appearances || 0;
    ratingWeight += w;
    ratingSum += (r.rating ?? 0) * w;
  }
  total.score = Math.round(total.score * 10) / 10;
  total.rating = ratingWeight > 0 ? Math.round((ratingSum / ratingWeight) * 10) / 10 : 0;
  return total;
}
