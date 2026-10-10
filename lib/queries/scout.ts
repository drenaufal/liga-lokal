import { and, asc, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/lib/db";
import { positionLine, rolesOfLine } from "@/lib/positions";
import { ascNullsLast } from "@/lib/db/order";
import { kuNameSql } from "@/lib/queries/ku";
import { getTournamentBase } from "@/lib/queries/competition";
import {
  aiReports,
  ageCategories,
  clubs,
  competitions,
  matchEvents,
  matches,
  players,
  playerStats,
  scoutShortlists,
  standings,
  tournaments,
} from "@/lib/db/schema";
import type { ScoutFilters } from "@/lib/ai/parse";
import { computeScore, DEFAULT_WEIGHTS } from "@/lib/scoring";

export async function runTalentSearch(filters: ScoutFilters, weights = DEFAULT_WEIGHTS) {
  const conds: SQL[] = [eq(playerStats.season, "career"), sql`${playerStats.appearances} > 0`];
  if (filters.position) conds.push(inArray(players.position, [...rolesOfLine(filters.position)]));
  if (filters.ageCode) conds.push(eq(ageCategories.code, filters.ageCode));
  if (filters.minGoals) conds.push(gte(playerStats.goals, filters.minGoals));
  if (filters.minAssists) conds.push(gte(playerStats.assists, filters.minAssists));
  if (filters.minSaves) conds.push(gte(playerStats.saves, filters.minSaves));

  const rows = await db
    .select({
      id: players.id,
      name: players.fullName,
      position: players.position,
      ageCode: ageCategories.code,
      club: clubs.shortName,
      photoUrl: players.photoUrl,
      appearances: playerStats.appearances,
      minutesPlayed: playerStats.minutesPlayed,
      goals: playerStats.goals,
      assists: playerStats.assists,
      saves: playerStats.saves,
      tackles: playerStats.tackles,
      interceptions: playerStats.interceptions,
      keyPasses: playerStats.keyPasses,
      duelsWon: playerStats.duelsWon,
      cleanSheets: playerStats.cleanSheets,
      yellowCards: playerStats.yellowCards,
      redCards: playerStats.redCards,
      motm: playerStats.motm,
      score: playerStats.score,
      rating: playerStats.rating,
    })
    .from(playerStats)
    .innerJoin(players, eq(players.id, playerStats.playerId))
    .leftJoin(clubs, eq(clubs.id, players.clubId))
    .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
    .where(and(...conds))
    .limit(120);

  // rank by an emphasis-weighted composite
  const scored = rows.map((r) => {
    const per90 = (n: number) => (r.minutesPlayed ? (n / r.minutesPlayed) * 90 : 0);
    let fit = computeScore(
      {
        goals: r.goals, assists: r.assists, saves: r.saves, tackles: r.tackles,
        interceptions: r.interceptions, keyPasses: r.keyPasses, duelsWon: r.duelsWon,
        cleanSheets: r.cleanSheets, yellowCards: r.yellowCards, redCards: r.redCards,
        minutesPlayed: r.minutesPlayed, motm: r.motm,
      },
      weights,
    );
    for (const e of filters.emphasis) {
      if (e === "attack") fit += per90(r.goals) * 20;
      if (e === "creation") fit += (per90(r.assists) + per90(r.keyPasses) * 0.5) * 18;
      if (e === "defending") fit += per90(r.tackles + r.interceptions) * 6;
      if (e === "keeping") fit += per90(r.saves) * 5 + r.cleanSheets * 3;
      if (e === "workrate") fit += per90(r.tackles + r.duelsWon) * 3;
      if (e === "discipline") fit += (r.yellowCards + r.redCards === 0 ? 12 : -4);
    }
    return { ...r, fit: Math.round(fit * 10) / 10 };
  });

  scored.sort((a, b) => b.fit - a.fit);
  return scored.slice(0, 12);
}

export async function getPlayerReportContext(playerId: string) {
  const p = await db
    .select({
      name: players.fullName,
      position: players.position,
      ageCategoryId: players.ageCategoryId,
      ageCode: ageCategories.code,
      club: clubs.shortName,
      stat: playerStats,
    })
    .from(players)
    .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
    .leftJoin(clubs, eq(clubs.id, players.clubId))
    .innerJoin(
      playerStats,
      and(eq(playerStats.playerId, players.id), eq(playerStats.season, "career")),
    )
    .where(eq(players.id, playerId))
    .then((r) => r[0]);
  if (!p) return null;

  const peers = await db
    .select({
      score: playerStats.score,
      goals: playerStats.goals,
      assists: playerStats.assists,
      saves: playerStats.saves,
    })
    .from(playerStats)
    .innerJoin(players, eq(players.id, playerStats.playerId))
    .where(
      and(
        eq(playerStats.season, "career"),
        sql`${playerStats.appearances} > 0`,
        inArray(players.position, [...rolesOfLine(positionLine(p.position))]),
        p.ageCategoryId ? eq(players.ageCategoryId, p.ageCategoryId) : sql`true`,
      ),
    );

  return { player: p, peers };
}

export async function getMatchReportContext(matchId: string) {
  const m = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!m || !m.homeClubId || !m.awayClubId) return null;
  const [home, away] = await Promise.all([
    db.query.clubs.findFirst({ where: eq(clubs.id, m.homeClubId) }),
    db.query.clubs.findFirst({ where: eq(clubs.id, m.awayClubId) }),
  ]);
  const evs = await db
    .select({
      type: matchEvents.type,
      minute: matchEvents.minute,
      clubId: matchEvents.clubId,
      player: players.fullName,
    })
    .from(matchEvents)
    .leftJoin(players, eq(players.id, matchEvents.playerId))
    .where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.voided, false)));

  return {
    home: home?.name ?? "Tuan rumah",
    away: away?.name ?? "Tamu",
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeFormation: m.homeFormation ?? "4-3-3",
    awayFormation: m.awayFormation ?? "4-3-3",
    events: evs.map((e) => ({
      type: e.type,
      minute: e.minute,
      team: (e.clubId === m.homeClubId ? "home" : "away") as "home" | "away",
      player: e.player,
    })),
    tournamentId: m.tournamentId,
  };
}

export async function getCompetitionReportContext(tournamentId: string) {
  const t = await getTournamentBase(tournamentId);
  if (!t) return null;
  const agg = await db
    .select({
      played: sql<number>`count(case when ${matches.status} = 'completed' then 1 end)`,
      goals: sql<number>`coalesce(sum(case when ${matches.status}='completed' then ${matches.homeScore} + ${matches.awayScore} end),0)`,
    })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));
  const cards = await db
    .select({ n: sql<number>`count(*)` })
    .from(matchEvents)
    .innerJoin(matches, eq(matches.id, matchEvents.matchId))
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        sql`${matchEvents.type} in ('yellow_card','red_card')`,
      ),
    );
  const top = await db
    .select({ name: clubs.name })
    .from(standings)
    .innerJoin(clubs, eq(clubs.id, standings.clubId))
    .where(and(eq(standings.tournamentId, tournamentId), eq(standings.rank, 1)))
    .limit(1);

  const played = Number(agg[0].played);
  return {
    name: t.name,
    matchesPlayed: played,
    totalGoals: Number(agg[0].goals),
    avgCardsPerMatch: played ? Number(cards[0].n) / played : 0,
    topClub: top[0]?.name ?? null,
  };
}

export async function listReports() {
  return db
    .select()
    .from(aiReports)
    .orderBy(desc(aiReports.createdAt))
    .limit(20);
}

export async function getReport(id: string) {
  return db.query.aiReports.findFirst({ where: eq(aiReports.id, id) });
}

export async function listShortlists(ownerId?: string) {
  return db
    .select()
    .from(scoutShortlists)
    .orderBy(desc(scoutShortlists.createdAt))
    .limit(10);
}

export async function getReportSubjectOptions() {
  const hc = alias(clubs, "hc");
  const ac = alias(clubs, "ac");
  const [pl, mt, tn] = await Promise.all([
    db
      .select({ id: players.id, name: players.fullName })
      .from(players)
      .innerJoin(playerStats, and(eq(playerStats.playerId, players.id), eq(playerStats.season, "career")))
      .where(gte(playerStats.appearances, 3))
      .orderBy(desc(playerStats.score))
      .limit(40),
    db
      .select({
        id: matches.id,
        home: hc.shortName,
        away: ac.shortName,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(matches)
      .leftJoin(hc, eq(hc.id, matches.homeClubId))
      .leftJoin(ac, eq(ac.id, matches.awayClubId))
      .where(eq(matches.status, "completed"))
      .orderBy(desc(matches.scheduledAt))
      .limit(30),
    db
      .select({ id: tournaments.id, name: kuNameSql })
      .from(tournaments)
      .innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
      .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
      .orderBy(asc(competitions.name), ascNullsLast(ageCategories.sortOrder)),
  ]);
  return {
    players: pl,
    matches: mt.map((m) => ({ id: m.id, label: `${m.home} ${m.homeScore}-${m.awayScore} ${m.away}` })),
    tournaments: tn,
  };
}
