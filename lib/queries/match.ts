import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { matchScopeFilter } from "@/lib/club-scope";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/lib/db";
import { MATCH_DURATION_SQL } from "@/lib/match-clock";
import { getEligibleMatchPlayers } from "@/lib/queries/match-roster";
import { getAssignedOperators } from "@/lib/match-officials";
import {
  ageCategories,
  clubs,
  competitions,
  matchEvents,
  matchLineups,
  matches,
  players,
  referees,
  tournaments,
  users,
  venues,
} from "@/lib/db/schema";
import { ascNullsLast } from "@/lib/db/order";
import { licenseStatus } from "@/lib/status";
import { kuNameSql } from "@/lib/queries/ku";
import { withMatchGoals } from "@/lib/queries/match-goals";

const hc = () => alias(clubs, "hc");
const ac = () => alias(clubs, "ac");

export type MatchListParams = {
  status?: string;
  tournament?: string;
  q?: string;
};

export async function listMatches(params: MatchListParams, scope: string[] | null = null) {
  const H = hc();
  const A = ac();
  const conds = [];
  const scoped = matchScopeFilter(scope);
  if (scoped) conds.push(scoped);
  if (params.status)
    conds.push(
      eq(
        matches.status,
        params.status as "scheduled" | "live" | "completed" | "postponed" | "cancelled",
      ),
    );
  if (params.tournament) conds.push(eq(matches.tournamentId, params.tournament));

  const rows = await db
    .select({
      id: matches.id,
      stage: matches.stage,
      round: matches.round,
      groupLabel: matches.groupLabel,
      scheduledAt: matches.scheduledAt,
      status: matches.status,
      period: matches.period,
      currentMinute: matches.currentMinute,
      clockStartedAt: matches.clockStartedAt,
      duration: sql<number>`${sql.raw(MATCH_DURATION_SQL)}`,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeClubId: matches.homeClubId,
      awayClubId: matches.awayClubId,
      resultStatus: matches.resultStatus,
      homeName: H.name,
      homeShort: H.shortName,
      homeLogo: H.logoUrl,
      awayName: A.name,
      awayShort: A.shortName,
      awayLogo: A.logoUrl,
      tournamentName: kuNameSql,
      venue: venues.name,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .leftJoin(H, eq(H.id, matches.homeClubId))
    .leftJoin(A, eq(A.id, matches.awayClubId))
    .leftJoin(venues, eq(venues.id, matches.venueId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(
      sql`case ${matches.status} when 'live' then 0 when 'scheduled' then 1 else 2 end`,
      params.status === "completed" ? desc(matches.scheduledAt) : asc(matches.scheduledAt),
    )
    .limit(120);

  // One entry per KU, grouped by Turnamen in the filter.
  const tournamentOpts = await db
    .select({
      id: tournaments.id,
      competition: competitions.name,
      ageCode: ageCategories.code,
    })
    .from(tournaments)
    .innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .orderBy(asc(competitions.name), ascNullsLast(ageCategories.sortOrder));

  return { rows: await withMatchGoals(rows), tournamentOpts };
}

export async function getMatchConsole(id: string) {
  const H = hc();
  const A = ac();
  const rows = await db
    .select({
      m: matches,
      tournamentName: kuNameSql,
      tournamentId: tournaments.id,
      ageDuration: ageCategories.rules,
      homeName: H.name,
      homeShort: H.shortName,
      homeLogo: H.logoUrl,
      awayName: A.name,
      awayShort: A.shortName,
      awayLogo: A.logoUrl,
      venue: venues.name,
      referee: referees.fullName,
      refereeId: referees.id,
      operator: users.name,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .leftJoin(H, eq(H.id, matches.homeClubId))
    .leftJoin(A, eq(A.id, matches.awayClubId))
    .leftJoin(venues, eq(venues.id, matches.venueId))
    .leftJoin(referees, eq(referees.id, matches.refereeId))
    .leftJoin(users, eq(users.id, matches.operatorId))
    .where(eq(matches.id, id));

  if (!rows.length) return null;
  const row = rows[0];
  const m = row.m;
  const operators = await getAssignedOperators(id, m.operatorId);
  const recorder = alias(users, "event_recorder");

  const events = await db
    .select({
      id: matchEvents.id,
      type: matchEvents.type,
      minute: matchEvents.minute,
      addedTime: matchEvents.addedTime,
      period: matchEvents.period,
      clubId: matchEvents.clubId,
      playerId: matchEvents.playerId,
      relatedPlayerId: matchEvents.relatedPlayerId,
      voided: matchEvents.voided,
      detail: matchEvents.detail,
      playerName: players.fullName,
      recorderName: recorder.name,
      createdAt: matchEvents.createdAt,
    })
    .from(matchEvents)
    .leftJoin(players, eq(players.id, matchEvents.playerId))
    .leftJoin(recorder, eq(recorder.id, matchEvents.createdBy))
    .where(eq(matchEvents.matchId, id))
    .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt));

  const lineups = await db
    .select({
      id: matchLineups.id,
      clubId: matchLineups.clubId,
      playerId: matchLineups.playerId,
      role: matchLineups.role,
      slot: matchLineups.slot,
      x: matchLineups.x,
      y: matchLineups.y,
      shirtNumber: matchLineups.shirtNumber,
      isCaptain: matchLineups.isCaptain,
      name: players.fullName,
      position: players.position,
    })
    .from(matchLineups)
    .innerJoin(players, eq(players.id, matchLineups.playerId))
    .where(eq(matchLineups.matchId, id));

  // squad options for event entry — players of either club in this tournament's age category
  const squadIds = [m.homeClubId, m.awayClubId].filter(Boolean) as string[];
  const squads = await getEligibleMatchPlayers(m.tournamentId, squadIds);

  const [scorers] = await withMatchGoals([{ id }]);
  return { ...row, m, operators, events, lineups, squads, goals: scorers.goals };
}

/** Referees with a valid license and the people who can run a match console. */
export async function getOfficialOptions() {
  const [refs, ops] = await Promise.all([
    db
      .select({
        id: referees.id,
        name: referees.fullName,
        level: referees.licenseLevel,
        city: referees.city,
        expiry: referees.licenseExpiry,
        status: referees.status,
      })
      .from(referees)
      .orderBy(asc(referees.fullName)),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.active, true), inArray(users.role, ["operator", "admin"])))
      .orderBy(asc(users.name)),
  ]);
  return {
    referees: refs
      .map((r) => ({ ...r, license: licenseStatus(r.expiry, r.status === "revoked") }))
      .filter((r) => r.license === "active" || r.license === "expiring"),
    operators: ops,
  };
}

export async function getLiveMatchState(id: string) {
  const H = hc();
  const A = ac();
  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      period: matches.period,
      currentMinute: matches.currentMinute,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeShort: H.shortName,
      awayShort: A.shortName,
    })
    .from(matches)
    .leftJoin(H, eq(H.id, matches.homeClubId))
    .leftJoin(A, eq(A.id, matches.awayClubId))
    .where(eq(matches.id, id));
  return rows[0] ?? null;
}

void gte;
