import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, tournaments } from "@/lib/db/schema";
import { getCompetitionScope } from "@/lib/auth/session";
import { inCompetitionScope } from "@/lib/competition-scope";
import { getSafeT } from "@/lib/i18n/server";

/**
 * Server-action guards for the Turnamen scope: an operator may only change the Turnamen
 * assigned to them, and the KUs and matches inside it. Each is a no-op for accounts that
 * see every Turnamen. A record that does not exist passes — the action reports that itself.
 */

async function refuse() {
  const t = await getSafeT();
  return new Error(t("Turnamen ini tidak ditugaskan kepada Anda."));
}

export async function assertCompetitionAccess(competitionId: string) {
  const scope = await getCompetitionScope();
  if (scope && !inCompetitionScope(scope, competitionId)) throw await refuse();
}

export async function assertKuAccess(kuId: string) {
  const scope = await getCompetitionScope();
  if (!scope) return;
  const [ku] = await db.select({ competitionId: tournaments.competitionId }).from(tournaments).where(eq(tournaments.id, kuId));
  if (ku && !inCompetitionScope(scope, ku.competitionId)) throw await refuse();
}

export async function assertMatchAccess(matchId: string) {
  const scope = await getCompetitionScope();
  if (!scope) return;
  const [m] = await db
    .select({ competitionId: tournaments.competitionId })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .where(eq(matches.id, matchId));
  if (m && !inCompetitionScope(scope, m.competitionId)) throw await refuse();
}
