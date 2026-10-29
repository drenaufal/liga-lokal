import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/lib/db";
import { ageCategories, clubs, competitions, matchEvents, matches, players, tournaments } from "@/lib/db/schema";
import { MATCH_DURATION_SQL, clockCap } from "@/lib/match-clock";
import { liveMinute } from "@/lib/match-engine";
import { competitionBucket } from "@/lib/competition-view";
import { listCompetitions } from "@/lib/queries/competition";
import { NOTABLE_EVENTS, type FeaturedTournament, type LiveEvent, type LiveFeed, type LiveMatch } from "@/lib/live-feed";

/** How far back the feed looks for events. Only fresh ones are ever celebrated; the rest is context. */
const EVENT_WINDOW_MS = 10 * 60_000;
/** Many visitors polling at once share one read of the database. */
const CACHE_MS = 2_000;

let cache: { at: number; value: Promise<LiveFeed> } | undefined;

/** Every match in play, and what the operators recorded in them over the last few minutes. */
export function getLiveFeed(): Promise<LiveFeed> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.value;
  const value = readLiveFeed().catch((e) => {
    cache = undefined; // do not keep a failure around
    throw e;
  });
  cache = { at: now, value };
  return value;
}

async function readLiveFeed(): Promise<LiveFeed> {
  const serverTime = new Date();
  const H = alias(clubs, "live_home");
  const A = alias(clubs, "live_away");

  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      currentMinute: matches.currentMinute,
      clockStartedAt: matches.clockStartedAt,
      duration: sql<number>`${sql.raw(MATCH_DURATION_SQL)}`,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      competitionId: competitions.id,
      competitionName: competitions.name,
      kuCode: ageCategories.code,
      homeShort: H.shortName,
      homeName: H.name,
      homeLogo: H.logoUrl,
      awayShort: A.shortName,
      awayName: A.name,
      awayLogo: A.logoUrl,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .leftJoin(H, eq(H.id, matches.homeClubId))
    .leftJoin(A, eq(A.id, matches.awayClubId))
    .where(inArray(matches.status, ["live", "halftime"]))
    .orderBy(asc(matches.scheduledAt))
    .limit(60);

  const liveMatches: LiveMatch[] = rows.map((r) => ({
    id: r.id,
    competitionId: r.competitionId,
    competitionName: r.competitionName,
    kuCode: r.kuCode,
    homeShort: r.homeShort,
    homeName: r.homeName,
    homeLogo: r.homeLogo,
    awayShort: r.awayShort,
    awayName: r.awayName,
    awayLogo: r.awayLogo,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    status: r.status === "halftime" ? "halftime" : "live",
    minute: liveMinute({ currentMinute: r.currentMinute, clockStartedAt: r.clockStartedAt, status: r.status }, clockCap(Number(r.duration))),
  }));

  if (!liveMatches.length) return { serverTime: serverTime.toISOString(), matches: [], events: [] };

  const byId = new Map(liveMatches.map((m) => [m.id, m]));
  const recent = await db
    .select({
      id: matchEvents.id,
      matchId: matchEvents.matchId,
      type: matchEvents.type,
      minute: matchEvents.minute,
      addedTime: matchEvents.addedTime,
      createdAt: matchEvents.createdAt,
      playerName: players.fullName,
      clubShort: clubs.shortName,
    })
    .from(matchEvents)
    .leftJoin(players, eq(players.id, matchEvents.playerId))
    .leftJoin(clubs, eq(clubs.id, matchEvents.clubId))
    .where(
      and(
        inArray(matchEvents.matchId, [...byId.keys()]),
        eq(matchEvents.voided, false),
        inArray(matchEvents.type, [...NOTABLE_EVENTS]),
        gte(matchEvents.createdAt, new Date(serverTime.getTime() - EVENT_WINDOW_MS)),
      ),
    )
    .orderBy(desc(matchEvents.createdAt))
    .limit(50);

  const events: LiveEvent[] = recent.flatMap((e) => {
    const m = byId.get(e.matchId);
    if (!m) return [];
    return [
      {
        id: e.id,
        matchId: e.matchId,
        competitionId: m.competitionId,
        competitionName: m.competitionName,
        type: e.type as LiveEvent["type"],
        minute: e.minute,
        addedTime: e.addedTime,
        playerName: e.playerName,
        clubShort: e.clubShort,
        homeShort: m.homeShort,
        awayShort: m.awayShort,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        createdAt: e.createdAt.toISOString(),
      },
    ];
  });

  return { serverTime: serverTime.toISOString(), matches: liveMatches, events };
}

/**
 * Tournaments to show on the home page: the ones being played now (live first), then the ones that
 * open soon. Drafts, finished and archived ones stay out.
 */
export async function getFeaturedTournaments(limit = 12): Promise<FeaturedTournament[]> {
  const all = await listCompetitions();
  const rank = { live: 0, running: 1, soon: 2 } as const;
  return all
    .flatMap((c): FeaturedTournament[] => {
      const bucket = competitionBucket(c);
      const state = c.liveMatches > 0 ? "live" : bucket === "running" ? "running" : bucket === "upcoming" && c.status !== "draft" ? "soon" : null;
      if (!state) return [];
      return [
        {
          id: c.id,
          name: c.name,
          season: c.season,
          organizer: c.organizer,
          state,
          liveMatches: c.liveMatches,
          kus: c.kus.map((k) => k.ageCode).filter((k): k is string => !!k),
          clubs: c.teams,
          played: c.playedMatches,
          total: c.totalMatches,
          startDate: c.startDate,
          endDate: c.endDate,
        },
      ];
    })
    .sort(
      (a, b) =>
        rank[a.state] - rank[b.state] ||
        (a.state === "soon" ? (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999") : b.liveMatches - a.liveMatches),
    )
    .slice(0, limit);
}
