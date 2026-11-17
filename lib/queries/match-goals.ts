import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchDspSubmissions, matchEvents, matchLineups, matches, players } from "@/lib/db/schema";

export type MatchGoal = { id: string; clubId: string | null; playerName: string | null; number: number | null; minute: number; addedTime: number | null; ownGoal: boolean };

/** Batch scorer lookup for all match cards; own goals belong to the opposing side. */
export async function withMatchGoals<T extends { id: string }>(rows: T[]): Promise<(T & { goals: MatchGoal[]; homeDspSubmitted: boolean; awayDspSubmitted: boolean })[]> {
  if (!rows.length) return [];
  const goals = await db.select({
    id: matchEvents.id, matchId: matchEvents.matchId,
    clubId: sql<string | null>`case when ${matchEvents.type} = 'own_goal' then case when ${matchEvents.clubId} = ${matches.homeClubId} then ${matches.awayClubId} else ${matches.homeClubId} end else ${matchEvents.clubId} end`,
    playerName: players.fullName,
    number: sql<number | null>`coalesce(${matchLineups.shirtNumber}, ${players.jerseyNumber})`,
    minute: matchEvents.minute, addedTime: matchEvents.addedTime,
    ownGoal: sql<boolean>`${matchEvents.type} = 'own_goal'`,
  }).from(matchEvents)
    .innerJoin(matches, eq(matches.id, matchEvents.matchId))
    .leftJoin(players, eq(players.id, matchEvents.playerId))
    .leftJoin(matchLineups, and(eq(matchLineups.matchId, matchEvents.matchId), eq(matchLineups.playerId, matchEvents.playerId)))
    .where(and(inArray(matchEvents.matchId, rows.map((r) => r.id)), eq(matchEvents.voided, false), inArray(matchEvents.type, ["goal", "penalty_goal", "own_goal"])))
    .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt));
  const submissions = await db.select({ matchId: matchDspSubmissions.matchId, clubId: matchDspSubmissions.clubId, homeClubId: matches.homeClubId, awayClubId: matches.awayClubId })
    .from(matchDspSubmissions).innerJoin(matches, eq(matches.id, matchDspSubmissions.matchId)).where(inArray(matchDspSubmissions.matchId, rows.map((r) => r.id)));
  return rows.map((row) => ({ ...row, goals: goals.filter((g) => g.matchId === row.id),
    homeDspSubmitted: submissions.some((s) => s.matchId === row.id && s.clubId === s.homeClubId),
    awayDspSubmitted: submissions.some((s) => s.matchId === row.id && s.clubId === s.awayClubId),
  }));
}
