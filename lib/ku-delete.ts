import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiReports,
  matches,
  playerBadges,
  playerStats,
  scoringFormulas,
  tournaments,
  type FormulaWeights,
} from "@/lib/db/schema";
import { COUNTER_FIELDS } from "@/lib/player-stats";
import { DEFAULT_WEIGHTS, computeRating, computeScore } from "@/lib/scoring";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The active scoring formula's weights (falls back to the defaults). */
export async function activeFormulaWeights(): Promise<FormulaWeights> {
  const formula = await db.query.scoringFormulas.findFirst({ where: eq(scoringFormulas.isActive, true) });
  return formula?.weights ?? DEFAULT_WEIGHTS;
}

/**
 * Deletes one KU with everything inside it. Before it goes, its numbers are
 * taken back out of each player's career totals; its awards and generated
 * reports are removed; teams, squads, standings, matches, events, line-ups and
 * per-KU stats follow through the foreign keys. Call inside a transaction.
 */
export async function purgeKu(tx: Tx, kuId: string, weights: FormulaWeights) {
  // 1. the KU's contribution comes out of every career line
  const rows = await tx.select().from(playerStats).where(eq(playerStats.tournamentId, kuId));
  for (const r of rows) {
    const [career] = await tx
      .select()
      .from(playerStats)
      .where(
        and(
          eq(playerStats.playerId, r.playerId),
          eq(playerStats.season, "career"),
          isNull(playerStats.tournamentId),
        ),
      )
      .limit(1)
      .for("update");
    if (!career) continue;
    const next = {} as Record<(typeof COUNTER_FIELDS)[number], number>;
    for (const f of COUNTER_FIELDS) next[f] = Math.max(0, career[f] - r[f]);
    await tx
      .update(playerStats)
      .set({
        ...next,
        score: computeScore(next, weights),
        rating: computeRating(next, next.appearances || 1, weights),
        updatedAt: new Date(),
      })
      .where(eq(playerStats.id, career.id));
  }

  // 2. awards and generated reports that belong to it
  await tx.delete(playerBadges).where(eq(playerBadges.tournamentId, kuId));
  const matchIds = (await tx.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, kuId))).map(
    (m) => m.id,
  );
  await tx
    .delete(aiReports)
    .where(
      or(
        and(eq(aiReports.subjectType, "tournament"), eq(aiReports.subjectId, kuId)),
        matchIds.length
          ? and(eq(aiReports.subjectType, "match"), inArray(aiReports.subjectId, matchIds))
          : undefined,
      ),
    );

  // 3. the KU itself; everything under it cascades
  await tx.delete(tournaments).where(eq(tournaments.id, kuId));
}
