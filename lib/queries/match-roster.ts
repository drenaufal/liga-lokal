import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { players, tournaments, tournamentTeams, tournamentSquad } from "@/lib/db/schema";
import { resolveMatchSquads } from "@/lib/match-squad";
import { getSafeT } from "@/lib/i18n/server";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function getEligibleMatchPlayers(kuId: string, clubIds: string[], executor: Executor = db) {
  if (!clubIds.length) return [];
  const [ku] = await executor.select().from(tournaments).where(eq(tournaments.id, kuId));
  if (!ku) throw new Error((await getSafeT())("KU tidak ditemukan"));
  const [registry, registered] = await Promise.all([
    executor.select({ id: players.id, name: players.fullName, clubId: players.clubId, secondClubId: players.secondClubId, position: players.position, jersey: players.jerseyNumber }).from(players)
      .where(and(or(inArray(players.clubId, clubIds), inArray(players.secondClubId, clubIds)), ku.ageCategoryId ? eq(players.ageCategoryId, ku.ageCategoryId) : undefined)),
    executor.select({ id: players.id, name: players.fullName, clubId: tournamentTeams.clubId, position: players.position, jersey: sql<number | null>`coalesce(${tournamentSquad.jerseyNumber}, ${players.jerseyNumber})` })
      .from(tournamentSquad).innerJoin(tournamentTeams, eq(tournamentTeams.id, tournamentSquad.tournamentTeamId)).innerJoin(players, eq(players.id, tournamentSquad.playerId))
      .where(and(eq(tournamentTeams.tournamentId, kuId), inArray(tournamentTeams.clubId, clubIds))),
  ]);
  return resolveMatchSquads(clubIds, registry, registered).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99) || a.name.localeCompare(b.name));
}
