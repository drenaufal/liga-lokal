import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

/**
 * Brings saved scoring formulas and every player's score & rating in line with the current
 * formula shape (the match buttons + playing time; see lib/scoring.ts).
 *
 *   npm run db:recompute-scores
 *
 * 1. Each saved formula's weights are rewritten as a complete, current set: keys it already had
 *    are kept, new ones (shot on / off target) take their defaults, retired ones are dropped.
 * 2. Every `player_stats` row is rescored under the active formula.
 *
 * Idempotent — running it again changes nothing. Only `weights`, `score` and `rating` are
 * written; no counter is touched.
 */
async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { playerStats, scoringFormulas } = await import("@/lib/db/schema");
  const { computeRating, computeScore, normalizeWeights } = await import("@/lib/scoring");

  const formulas = await db.select().from(scoringFormulas);
  let rewritten = 0;
  for (const f of formulas) {
    const weights = normalizeWeights(f.weights);
    if (JSON.stringify(weights) === JSON.stringify(f.weights)) continue;
    await db.update(scoringFormulas).set({ weights }).where(eq(scoringFormulas.id, f.id));
    rewritten++;
  }
  console.log(`Formulas: ${rewritten} of ${formulas.length} rewritten.`);

  const active = formulas.find((f) => f.isActive);
  const weights = normalizeWeights(active?.weights);
  const rows = await db.select().from(playerStats);
  let changed = 0;
  for (const r of rows) {
    const score = computeScore(r, weights);
    const rating = computeRating(r, r.appearances || 1, weights);
    if (score === r.score && rating === r.rating) continue;
    await db.update(playerStats).set({ score, rating }).where(eq(playerStats.id, r.id));
    changed++;
  }
  console.log(`Player stats: ${changed} of ${rows.length} rows rescored (${active?.name ?? "default weights"}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Recompute failed:", err);
  process.exit(1);
});
