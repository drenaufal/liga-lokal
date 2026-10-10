import { and, asc, count, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/lib/db";
import { MATCH_DURATION_SQL } from "@/lib/match-clock";
import {
  ageCategories,
  clubs,
  competitions,
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
import { ascNullsLast } from "@/lib/db/order";
import { competitionStatus, dateSpan, kuLabel } from "@/lib/ku";
import { getOfficialOptions } from "@/lib/queries/match";

/* ═════════════════════════ Turnamen (competitions) ═════════════════════════ */

/**
 * Every Turnamen with its KUs and match counts. `status` is derived from the
 * KUs (see competitionStatus), the dates span all of them.
 */
export async function listCompetitions() {
  const rows = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      season: competitions.season,
      organizer: competitions.organizer,
      description: competitions.description,
      createdAt: competitions.createdAt,
      // `${competitions}.id` (not `${competitions.id}`): this select has no join, so
      // Drizzle would print a bare `id` that binds to the subquery's own table.
      teams: sql<number>`(select count(distinct tt.club_id) from ${tournamentTeams} tt join ${tournaments} k on k.id = tt.tournament_id where k.competition_id = ${competitions}.id)`,
      totalMatches: sql<number>`(select count(*) from ${matches} m join ${tournaments} k on k.id = m.tournament_id where k.competition_id = ${competitions}.id)`,
      playedMatches: sql<number>`(select count(*) from ${matches} m join ${tournaments} k on k.id = m.tournament_id where k.competition_id = ${competitions}.id and m.status = 'completed')`,
      liveMatches: sql<number>`(select count(*) from ${matches} m join ${tournaments} k on k.id = m.tournament_id where k.competition_id = ${competitions}.id and m.status in ('live','halftime'))`,
    })
    .from(competitions)
    .orderBy(desc(competitions.createdAt));

  const kuRows = rows.length
    ? await db
        .select({
          id: tournaments.id,
          competitionId: tournaments.competitionId,
          ageCode: ageCategories.code,
          format: tournaments.format,
          status: tournaments.status,
          startDate: tournaments.startDate,
          endDate: tournaments.endDate,
        })
        .from(tournaments)
        .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
        .where(inArray(tournaments.competitionId, rows.map((r) => r.id)))
        .orderBy(ascNullsLast(ageCategories.sortOrder))
    : [];

  return rows.map((r) => {
    const kus = kuRows.filter((k) => k.competitionId === r.id);
    const span = dateSpan(kus.flatMap((k) => [k.startDate, k.endDate]));
    return {
      ...r,
      teams: Number(r.teams),
      totalMatches: Number(r.totalMatches),
      playedMatches: Number(r.playedMatches),
      liveMatches: Number(r.liveMatches),
      kus,
      status: competitionStatus(kus.map((k) => k.status)),
      startDate: span.from,
      endDate: span.to,
    };
  });
}

export async function getCompetition(id: string) {
  return (await db.query.competitions.findFirst({ where: eq(competitions.id, id) })) ?? null;
}

/** A Turnamen with one line per KU (counts included) and totals across them. */
export async function getCompetitionOverview(id: string) {
  const competition = await getCompetition(id);
  if (!competition) return null;

  const kus = await db
    .select({
      id: tournaments.id,
      ageCategoryId: tournaments.ageCategoryId,
      ageCode: ageCategories.code,
      ageLabel: ageCategories.label,
      format: tournaments.format,
      status: tournaments.status,
      city: tournaments.city,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      teams: sql<number>`(select count(*) from ${tournamentTeams} tt where tt.tournament_id = ${tournaments.id})`,
      totalMatches: sql<number>`(select count(*) from ${matches} m where m.tournament_id = ${tournaments.id})`,
      playedMatches: sql<number>`(select count(*) from ${matches} m where m.tournament_id = ${tournaments.id} and m.status = 'completed')`,
      liveMatches: sql<number>`(select count(*) from ${matches} m where m.tournament_id = ${tournaments.id} and m.status in ('live','halftime'))`,
      goals: sql<number>`(select coalesce(sum(m.home_score + m.away_score), 0) from ${matches} m where m.tournament_id = ${tournaments.id} and m.status = 'completed')`,
    })
    .from(tournaments)
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(eq(tournaments.competitionId, id))
    .orderBy(ascNullsLast(ageCategories.sortOrder));

  const items = kus.map((k) => ({
    ...k,
    teams: Number(k.teams),
    totalMatches: Number(k.totalMatches),
    playedMatches: Number(k.playedMatches),
    liveMatches: Number(k.liveMatches),
    goals: Number(k.goals),
  }));

  const [teamAgg] = await db
    .select({ clubs: sql<number>`count(distinct ${tournamentTeams.clubId})` })
    .from(tournamentTeams)
    .innerJoin(tournaments, eq(tournaments.id, tournamentTeams.tournamentId))
    .where(eq(tournaments.competitionId, id));

  const span = dateSpan(items.flatMap((k) => [k.startDate, k.endDate]));
  const completed = items.reduce((a, k) => a + k.playedMatches, 0);
  const goals = items.reduce((a, k) => a + k.goals, 0);

  const [recentResults, upcoming] = await Promise.all([
    matchRows(and(eq(tournaments.competitionId, id), eq(matches.status, "completed")), [desc(matches.scheduledAt)], 5),
    matchRows(and(eq(tournaments.competitionId, id), eq(matches.status, "scheduled")), [asc(matches.scheduledAt)], 5),
  ]);

  return {
    competition,
    kus: items,
    status: competitionStatus(items.map((k) => k.status)),
    startDate: span.from,
    endDate: span.to,
    totals: {
      kus: items.length,
      clubs: Number(teamAgg?.clubs ?? 0),
      matches: items.reduce((a, k) => a + k.totalMatches, 0),
      completed,
      live: items.reduce((a, k) => a + k.liveMatches, 0),
      goals,
    },
    recentResults,
    upcoming,
  };
}

/** Every match of every KU in a Turnamen, oldest first, tagged with its KU. */
export async function getCompetitionFixtures(id: string) {
  return matchRows(eq(tournaments.competitionId, id), [asc(matches.scheduledAt)]);
}

/**
 * The KUs of a Turnamen with their participants — what the "add match" and
 * "upload schedule" dialogs need to offer the right teams per KU.
 */
export async function getCompetitionKuOptions(id: string) {
  const kus = await db
    .select({
      id: tournaments.id,
      ageCode: ageCategories.code,
      ageLabel: ageCategories.label,
      format: tournaments.format,
      status: tournaments.status,
      hasGroups: sql<number>`(${tournaments.groupCount} > 0)`,
    })
    .from(tournaments)
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(eq(tournaments.competitionId, id))
    .orderBy(ascNullsLast(ageCategories.sortOrder));
  if (kus.length === 0) return [];

  const teams = await db
    .select({
      kuId: tournamentTeams.tournamentId,
      clubId: clubs.id,
      short: clubs.shortName,
      name: clubs.name,
    })
    .from(tournamentTeams)
    .innerJoin(clubs, eq(clubs.id, tournamentTeams.clubId))
    .where(inArray(tournamentTeams.tournamentId, kus.map((k) => k.id)))
    .orderBy(asc(clubs.name));

  return kus.map((k) => ({
    ...k,
    hasGroups: !!Number(k.hasGroups),
    teams: teams.filter((t) => t.kuId === k.id).map(({ clubId, short, name }) => ({ clubId, short, name })),
  }));
}

/** Venues and referees with a valid license — the optional extras of a match. */
export async function getScheduleOptions() {
  const [venueRows, officials] = await Promise.all([
    db.select({ id: venues.id, name: venues.name, city: venues.city }).from(venues).orderBy(asc(venues.name)),
    getOfficialOptions(),
  ]);
  return {
    venues: venueRows,
    referees: officials.referees.map((r) => ({ id: r.id, name: r.name, level: r.level })),
  };
}

/** What deleting a Turnamen (all of its KUs) would take with it. */
export async function getCompetitionImpact(id: string) {
  const kuIds = (await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.competitionId, id))).map(
    (k) => k.id,
  );
  return { kus: kuIds.length, ...(await impactOf(kuIds)) };
}

/* ═════════════════════════════ KU (tournaments) ═════════════════════════════ */

/** A KU with its Turnamen, age category and scoring formula; `name` is "<turnamen> · KU-14". */
export async function getTournamentBase(id: string) {
  const [row] = await db
    .select({
      t: tournaments,
      competition: competitions,
      ageCategory: ageCategories,
      scoringFormula: scoringFormulas,
    })
    .from(tournaments)
    .innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .leftJoin(scoringFormulas, eq(scoringFormulas.id, tournaments.scoringFormulaId))
    .where(eq(tournaments.id, id));
  if (!row) return null;
  return {
    ...row.t,
    name: kuLabel(row.competition.name, row.ageCategory?.code),
    competition: row.competition,
    ageCategory: row.ageCategory,
    scoringFormula: row.scoringFormula,
  };
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

/* ═════════════════════════════ Matches ═════════════════════════════════ */

/** The columns every match list needs; `where` may touch matches/tournaments/ageCategories. */
async function matchRows(where: SQL | undefined, order: SQL[], limit?: number) {
  const hc = alias(clubs, "hc");
  const ac = alias(clubs, "ac");
  const q = db
    .select({
      id: matches.id,
      kuId: matches.tournamentId,
      ageCode: ageCategories.code,
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
      homePenalties: matches.homePenalties,
      awayPenalties: matches.awayPenalties,
      homeClubId: matches.homeClubId,
      awayClubId: matches.awayClubId,
      homeName: hc.name,
      homeShort: hc.shortName,
      homeLogo: hc.logoUrl,
      awayName: ac.name,
      awayShort: ac.shortName,
      awayLogo: ac.logoUrl,
      homePlaceholder: matches.homePlaceholder,
      awayPlaceholder: matches.awayPlaceholder,
      venue: venues.name,
      resultStatus: matches.resultStatus,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .leftJoin(hc, eq(hc.id, matches.homeClubId))
    .leftJoin(ac, eq(ac.id, matches.awayClubId))
    .leftJoin(venues, eq(venues.id, matches.venueId))
    .where(where)
    .orderBy(...order);
  return limit ? await q.limit(limit) : await q;
}

async function tournamentMatches(
  id: string,
  status: "completed" | "scheduled" | "live" | "all",
  limit?: number,
) {
  return matchRows(
    status === "all"
      ? eq(matches.tournamentId, id)
      : and(eq(matches.tournamentId, id), eq(matches.status, status)),
    [status === "completed" ? desc(matches.scheduledAt) : asc(matches.scheduledAt)],
    limit,
  );
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

const KNOCKOUT_STAGES = ["round_of_32", "round_of_16", "quarter", "semi", "final", "third_place"];

export async function getKnockoutMatches(id: string) {
  const all = await tournamentMatches(id, "all");
  return all
    .filter((m) => KNOCKOUT_STAGES.includes(m.stage))
    .sort((a, b) => a.round - b.round || (a.bracketSlot ?? "").localeCompare(b.bracketSlot ?? ""));
}

/* ═════════════════════════ Forms & helpers ═════════════════════════════ */

export async function getClubOptionsForTournament() {
  return db
    .select({ id: clubs.id, name: clubs.name, short: clubs.shortName })
    .from(clubs)
    .where(eq(clubs.active, true))
    .orderBy(asc(clubs.name));
}

/**
 * Everything the "add KU" form offers: the age categories (with the ones this
 * Turnamen already has marked), scoring formulas, the SSBs, and how many
 * players each SSB has per age category — so the form can show whether an SSB
 * can actually field a team in the chosen KU.
 */
export async function getKuFormOptions(competitionId: string) {
  const [ages, formulas, allClubs, taken, primary, second] = await Promise.all([
    db.select().from(ageCategories).orderBy(asc(ageCategories.sortOrder)),
    db.select().from(scoringFormulas).orderBy(desc(scoringFormulas.isActive)),
    getClubOptionsForTournament(),
    db
      .select({ ageCategoryId: tournaments.ageCategoryId })
      .from(tournaments)
      .where(eq(tournaments.competitionId, competitionId)),
    db
      .select({ clubId: players.clubId, ageCategoryId: players.ageCategoryId, n: count() })
      .from(players)
      .where(isNotNull(players.clubId))
      .groupBy(players.clubId, players.ageCategoryId),
    db
      .select({ clubId: players.secondClubId, ageCategoryId: players.ageCategoryId, n: count() })
      .from(players)
      .where(isNotNull(players.secondClubId))
      .groupBy(players.secondClubId, players.ageCategoryId),
  ]);

  const playerCounts: Record<string, Record<string, number>> = {};
  for (const r of [...primary, ...second]) {
    if (!r.clubId || !r.ageCategoryId) continue;
    const per = (playerCounts[r.clubId] ??= {});
    per[r.ageCategoryId] = (per[r.ageCategoryId] ?? 0) + Number(r.n);
  }

  return {
    ages,
    formulas,
    clubs: allClubs,
    usedAgeIds: taken.map((t) => t.ageCategoryId).filter((x): x is string => !!x),
    playerCounts,
  };
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

/** What deleting one KU would take with it. */
export async function getTournamentImpact(id: string) {
  return impactOf([id]);
}

async function impactOf(kuIds: string[]) {
  if (kuIds.length === 0)
    return { teams: 0, matches: 0, completed: 0, live: 0, confirmed: 0, events: 0, players: 0 };
  const [[teams], [mt], [ev], [pl]] = await Promise.all([
    db.select({ n: count() }).from(tournamentTeams).where(inArray(tournamentTeams.tournamentId, kuIds)),
    db
      .select({
        total: count(),
        completed: sql<number>`count(case when ${matches.status} = 'completed' then 1 end)`,
        live: sql<number>`count(case when ${matches.status} in ('live','halftime') then 1 end)`,
        confirmed: sql<number>`count(case when ${matches.resultStatus} in ('confirmed','amended') then 1 end)`,
      })
      .from(matches)
      .where(inArray(matches.tournamentId, kuIds)),
    db
      .select({ n: count() })
      .from(matchEvents)
      .innerJoin(matches, eq(matches.id, matchEvents.matchId))
      .where(inArray(matches.tournamentId, kuIds)),
    db
      .select({ n: sql<number>`count(distinct ${playerStats.playerId})` })
      .from(playerStats)
      .where(inArray(playerStats.tournamentId, kuIds)),
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
