import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/lib/db";
import { MATCH_DURATION_SQL } from "@/lib/match-clock";
import {
  ageCategories,
  clubs,
  matchEvents,
  matches,
  players,
  playerStats,
  scoringFormulas,
  standings,
  tournamentTeams,
  tournaments,
  venues,
} from "@/lib/db/schema";
import { ascNullsLast, descNullsFirst } from "@/lib/db/order";

export async function listTournaments() {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      slug: tournaments.slug,
      season: tournaments.season,
      format: tournaments.format,
      status: tournaments.status,
      host: tournaments.host,
      city: tournaments.city,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      logoUrl: tournaments.logoUrl,
      ageCode: ageCategories.code,
      teams: sql<number>`(select count(*) from ${tournamentTeams} tt where tt.tournament_id = ${tournaments.id})`,
      totalMatches: sql<number>`(select count(*) from ${matches} m where m.tournament_id = ${tournaments.id})`,
      playedMatches: sql<number>`(select count(*) from ${matches} m where m.tournament_id = ${tournaments.id} and m.status = 'completed')`,
      liveMatches: sql<number>`(select count(*) from ${matches} m where m.tournament_id = ${tournaments.id} and m.status = 'live')`,
    })
    .from(tournaments)
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .orderBy(descNullsFirst(tournaments.startDate));
  return rows;
}

export async function getTournamentBase(id: string) {
  const [row] = await db
    .select({ t: tournaments, ageCategory: ageCategories, scoringFormula: scoringFormulas })
    .from(tournaments)
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .leftJoin(scoringFormulas, eq(scoringFormulas.id, tournaments.scoringFormulaId))
    .where(eq(tournaments.id, id));
  return row && { ...row.t, ageCategory: row.ageCategory, scoringFormula: row.scoringFormula };
}

export async function getTournamentOverview(id: string) {
  const t = await getTournamentBase(id);
  if (!t) return null;

  const [teamRows, matchAgg, topScorers, recentResults, upcoming] = await Promise.all([
    db
      .select({
        id: tournamentTeams.id,
        clubId: clubs.id,
        name: clubs.name,
        short: clubs.shortName,
        color: clubs.primaryColor,
        logo: clubs.logoUrl,
        group: tournamentTeams.groupLabel,
        seed: tournamentTeams.seed,
        regStatus: tournamentTeams.registrationStatus,
      })
      .from(tournamentTeams)
      .innerJoin(clubs, eq(clubs.id, tournamentTeams.clubId))
      .where(eq(tournamentTeams.tournamentId, id))
      .orderBy(ascNullsLast(tournamentTeams.groupLabel), ascNullsLast(tournamentTeams.seed)),
    db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(case when ${matches.status} = 'completed' then 1 end)`,
        live: sql<number>`count(case when ${matches.status} = 'live' then 1 end)`,
        goals: sql<number>`coalesce(sum(case when ${matches.status}='completed' then ${matches.homeScore} + ${matches.awayScore} end),0)`,
      })
      .from(matches)
      .where(eq(matches.tournamentId, id)),
    db
      .select({
        id: players.id,
        name: players.fullName,
        club: clubs.shortName,
        goals: playerStats.goals,
        assists: playerStats.assists,
      })
      .from(playerStats)
      .innerJoin(players, eq(players.id, playerStats.playerId))
      .leftJoin(clubs, eq(clubs.id, players.clubId))
      .where(and(eq(playerStats.tournamentId, id), sql`${playerStats.goals} > 0`))
      .orderBy(desc(playerStats.goals), desc(playerStats.assists))
      .limit(6),
    tournamentMatches(id, "completed", 6),
    tournamentMatches(id, "scheduled", 6),
  ]);

  return { tournament: t, teams: teamRows, matchAgg: matchAgg[0], topScorers, recentResults, upcoming };
}

async function tournamentMatches(
  id: string,
  status: "completed" | "scheduled" | "live" | "all",
  limit?: number,
) {
  const hc = alias(clubs, "hc");
  const ac = alias(clubs, "ac");
  const q = db
    .select({
      id: matches.id,
      stage: matches.stage,
      round: matches.round,
      groupLabel: matches.groupLabel,
      bracketSlot: matches.bracketSlot,
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
      homeName: hc.name,
      homeShort: hc.shortName,
      homeColor: hc.primaryColor,
      homeLogo: hc.logoUrl,
      awayName: ac.name,
      awayShort: ac.shortName,
      awayColor: ac.primaryColor,
      awayLogo: ac.logoUrl,
      homePlaceholder: matches.homePlaceholder,
      awayPlaceholder: matches.awayPlaceholder,
      venue: venues.name,
      resultStatus: matches.resultStatus,
    })
    .from(matches)
    .leftJoin(hc, eq(hc.id, matches.homeClubId))
    .leftJoin(ac, eq(ac.id, matches.awayClubId))
    .leftJoin(venues, eq(venues.id, matches.venueId))
    .where(
      status === "all"
        ? eq(matches.tournamentId, id)
        : and(eq(matches.tournamentId, id), eq(matches.status, status)),
    )
    .orderBy(
      status === "completed" ? desc(matches.scheduledAt) : asc(matches.scheduledAt),
    );
  const rows = limit ? await q.limit(limit) : await q;
  return rows;
}

export async function getTournamentFixtures(id: string) {
  return tournamentMatches(id, "all");
}

export async function getTournamentStandings(id: string) {
  const rows = await db
    .select({
      clubId: standings.clubId,
      name: clubs.name,
      short: clubs.shortName,
      color: clubs.primaryColor,
      logo: clubs.logoUrl,
      group: standings.groupLabel,
      played: standings.played,
      won: standings.won,
      drawn: standings.drawn,
      lost: standings.lost,
      goalsFor: standings.goalsFor,
      goalsAgainst: standings.goalsAgainst,
      points: standings.points,
      form: standings.form,
      rank: standings.rank,
    })
    .from(standings)
    .innerJoin(clubs, eq(clubs.id, standings.clubId))
    .where(eq(standings.tournamentId, id))
    .orderBy(asc(standings.groupLabel), asc(standings.rank));
  return rows;
}

export async function getKnockoutMatches(id: string) {
  const all = await tournamentMatches(id, "all");
  return all
    .filter((m) =>
      ["round_of_16", "quarter", "semi", "final", "third_place"].includes(m.stage),
    )
    .sort((a, b) => a.round - b.round || (a.bracketSlot ?? "").localeCompare(b.bracketSlot ?? ""));
}

export async function getClubOptionsForTournament() {
  return db
    .select({ id: clubs.id, name: clubs.name, short: clubs.shortName })
    .from(clubs)
    .where(eq(clubs.active, true))
    .orderBy(asc(clubs.name));
}

export async function getFormOptions() {
  const [ages, formulas, allClubs] = await Promise.all([
    db.select().from(ageCategories).orderBy(asc(ageCategories.sortOrder)),
    db.select().from(scoringFormulas).orderBy(desc(scoringFormulas.isActive)),
    getClubOptionsForTournament(),
  ]);
  return { ages, formulas, clubs: allClubs };
}

/** Short codes of the clubs taking part — the values a schedule upload refers to them by. */
export async function getTournamentTeamShorts(id: string) {
  const rows = await db
    .select({ short: clubs.shortName })
    .from(tournamentTeams)
    .innerJoin(clubs, eq(clubs.id, tournamentTeams.clubId))
    .where(eq(tournamentTeams.tournamentId, id))
    .orderBy(asc(clubs.shortName));
  return rows.map((r) => r.short);
}

/** What deleting a tournament would take with it. */
export async function getTournamentImpact(id: string) {
  const [[teams], [mt], [ev], [pl]] = await Promise.all([
    db.select({ n: count() }).from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id)),
    db
      .select({
        total: count(),
        completed: sql<number>`count(case when ${matches.status} = 'completed' then 1 end)`,
        live: sql<number>`count(case when ${matches.status} in ('live','halftime') then 1 end)`,
        confirmed: sql<number>`count(case when ${matches.resultStatus} in ('confirmed','amended') then 1 end)`,
      })
      .from(matches)
      .where(eq(matches.tournamentId, id)),
    db
      .select({ n: count() })
      .from(matchEvents)
      .innerJoin(matches, eq(matches.id, matchEvents.matchId))
      .where(eq(matches.tournamentId, id)),
    db
      .select({ n: sql<number>`count(distinct ${playerStats.playerId})` })
      .from(playerStats)
      .where(eq(playerStats.tournamentId, id)),
  ]);
  return {
    teams: Number(teams.n),
    matches: Number(mt.total),
    completed: Number(mt.completed),
    live: Number(mt.live),
    confirmed: Number(mt.confirmed),
    events: Number(ev.n),
    players: Number(pl.n),
  };
}

void inArray;
