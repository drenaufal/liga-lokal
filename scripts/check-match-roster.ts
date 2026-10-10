import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const matchId = process.argv[2];
  if (!matchId) throw new Error("Usage: npx tsx scripts/check-match-roster.ts MATCH_ID");
  const { getMatchConsole } = await import("@/lib/queries/match");
  const { db } = await import("@/lib/db");
  const { players, tournaments, ageCategories } = await import("@/lib/db/schema");
  const { and, eq, or, count } = await import("drizzle-orm");
  const match = await getMatchConsole(matchId);
  if (!match) throw new Error("Match not found");
  const [category] = await db.select({ id: tournaments.ageCategoryId, code: ageCategories.code })
    .from(tournaments).leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(eq(tournaments.id, match.m.tournamentId));
  console.log(`Match: ${match.homeName} vs ${match.awayName}; category: ${category?.code ?? "all"}`);
  for (const clubId of [match.m.homeClubId, match.m.awayClubId]) {
    if (!clubId) continue;
    const membership = or(eq(players.clubId, clubId), eq(players.secondClubId, clubId));
    const [total] = await db.select({ n: count() }).from(players).where(membership);
    const [eligible] = await db.select({ n: count() }).from(players)
      .where(and(membership, category?.id ? eq(players.ageCategoryId, category.id) : undefined));
    console.log({ clubId, registryPlayers: total.n, matchingAgeCategory: eligible.n,
      loadedSquad: match.squads.filter((p) => p.clubId === clubId).length,
      matchLineup: match.lineups.filter((p) => p.clubId === clubId).length });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  const cause = error instanceof Error ? error.cause as { code?: string; message?: string } | undefined : undefined;
  console.error(cause?.message ?? (error instanceof Error ? error.message : "Roster check failed"));
  process.exit(1);
});
