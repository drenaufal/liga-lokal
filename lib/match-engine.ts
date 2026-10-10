import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ageCategories,
  competitions,
  matchEvents,
  matchLineups,
  matches,
  playerMatchStats,
  players,
  playerStats,
  tournaments,
} from "@/lib/db/schema";
import { computeRating, computeScore } from "@/lib/scoring";
import { DEFAULT_MATCH_MINUTES } from "@/lib/match-clock";
import {
  LINE_COUNTERS,
  buildMatchLines,
  diffLines,
  emptyLine,
  isZeroDelta,
  type LineCounter,
  type MatchLine,
} from "@/lib/match-lines";
import type { FormulaWeights } from "@/lib/db/schema";

/** Live match minute given stored minute + running clock (capped at 90+ stoppage). */
export function liveMinute(
  m: {
    currentMinute: number;
    clockStartedAt: Date | string | null;
    status: string;
  },
  cap = 96,
) {
  if (m.status !== "live" || !m.clockStartedAt) return m.currentMinute;
  const elapsed = Math.floor(
    (Date.now() - new Date(m.clockStartedAt).getTime()) / 60000,
  );
  return Math.min(cap, m.currentMinute + Math.max(0, elapsed));
}

const GOAL_TYPES = ["goal", "penalty_goal"];

/** Recompute a match's scoreline from its non-voided events. */
export async function recomputeMatchScore(matchId: string) {
  const evs = await db
    .select({
      type: matchEvents.type,
      clubId: matchEvents.clubId,
    })
    .from(matchEvents)
    .where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.voided, false)));

  const m = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!m) return;

  let home = 0;
  let away = 0;
  for (const e of evs) {
    if (GOAL_TYPES.includes(e.type)) {
      if (e.clubId === m.homeClubId) home++;
      else if (e.clubId === m.awayClubId) away++;
    } else if (e.type === "own_goal") {
      // own goal credits the opponent
      if (e.clubId === m.homeClubId) away++;
      else if (e.clubId === m.awayClubId) home++;
    }
  }

  await db
    .update(matches)
    .set({ homeScore: home, awayScore: away, updatedAt: new Date() })
    .where(eq(matches.id, matchId));
}

/* ── Player statistics ─────────────────────────────────────────────────── */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Adds `delta` to one stats row (creating it if needed) and refreshes its score
 * and rating. Tournament rows remember which club the numbers were earned for;
 * the career row (no tournament) is the all-clubs total.
 */
async function bumpStatRow(
  tx: Tx,
  a: {
    playerId: string;
    tournamentId: string | null;
    season: string;
    clubId: string | null;
    delta: Record<LineCounter, number>;
    weights: FormulaWeights;
  },
) {
  const where = a.tournamentId
    ? and(eq(playerStats.playerId, a.playerId), eq(playerStats.tournamentId, a.tournamentId))
    : and(
        eq(playerStats.playerId, a.playerId),
        eq(playerStats.season, "career"),
        isNull(playerStats.tournamentId),
      );
  const [row] = await tx.select().from(playerStats).where(where).limit(1).for("update");

  const next = {} as Record<LineCounter, number>;
  for (const f of LINE_COUNTERS) next[f] = Math.max(0, (row?.[f] ?? 0) + a.delta[f]);
  if (!row && LINE_COUNTERS.every((f) => next[f] === 0)) return; // nothing to record

  const scorable = {
    goals: next.goals,
    assists: next.assists,
    saves: next.saves,
    tackles: row?.tackles ?? 0,
    interceptions: next.interceptions,
    keyPasses: row?.keyPasses ?? 0,
    duelsWon: row?.duelsWon ?? 0,
    cleanSheets: row?.cleanSheets ?? 0,
    yellowCards: next.yellowCards,
    redCards: next.redCards,
    minutesPlayed: next.minutesPlayed,
    motm: next.motm,
  };
  const values = {
    ...next,
    score: computeScore(scorable, a.weights),
    rating: computeRating(scorable, next.appearances || 1, a.weights),
    // keep the first club a tournament row was attributed to; only fill a gap
    clubId: a.tournamentId ? (row?.clubId ?? a.clubId) : null,
    updatedAt: new Date(),
  };

  if (row) await tx.update(playerStats).set(values).where(eq(playerStats.id, row.id));
  else
    await tx.insert(playerStats).values({
      playerId: a.playerId,
      tournamentId: a.tournamentId,
      season: a.season,
      ...values,
    });
}

/**
 * Brings the player statistics in line with a match's current (non-voided)
 * events. Call it when a result is confirmed or amended.
 *
 * It keeps a per-match ledger (`player_match_stats`) of what it has already
 * applied, so it only ever adds the *difference*: confirming twice changes
 * nothing, and amending after an event was voided really takes it back.
 * Everything runs in one transaction, with the match row locked.
 */
export async function syncMatchStats(matchId: string, weights: FormulaWeights) {
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!m) return { players: 0 };

    const [tour] = await tx
      .select({ season: competitions.season, rules: ageCategories.rules })
      .from(tournaments)
      .innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
      .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
      .where(eq(tournaments.id, m.tournamentId));
    const duration = m.durationMinutes ?? tour?.rules?.matchDuration ?? DEFAULT_MATCH_MINUTES;
    const length = m.currentMinute > 0 ? m.currentMinute : duration;
    const season = tour?.season ?? "2026";

    const [events, lineups, ledger] = await Promise.all([
      tx
        .select()
        .from(matchEvents)
        .where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.voided, false))),
      tx.select().from(matchLineups).where(eq(matchLineups.matchId, matchId)),
      tx.select().from(playerMatchStats).where(eq(playerMatchStats.matchId, matchId)),
    ]);

    // A player's own club, for players whose events carry no club.
    const ids = new Set<string>();
    for (const e of events) {
      if (e.playerId) ids.add(e.playerId);
      if (e.relatedPlayerId) ids.add(e.relatedPlayerId);
    }
    for (const l of lineups) ids.add(l.playerId);
    const own = ids.size
      ? await tx
          .select({ id: players.id, clubId: players.clubId })
          .from(players)
          .where(inArray(players.id, [...ids]))
      : [];
    const ownClub = new Map(own.map((p) => [p.id, p.clubId]));

    const next = buildMatchLines({
      length,
      events,
      lineups,
      fallbackClub: (pid) => ownClub.get(pid) ?? null,
    });
    const nextBy = new Map(next.map((l) => [l.playerId, l]));

    // What was applied before. Matches confirmed before the ledger existed have
    // no rows: assume their numbers are already in the stats (change nothing),
    // and start tracking from here.
    let prev: MatchLine[] = ledger.map((r) => ({
      playerId: r.playerId,
      clubId: r.clubId,
      appearances: r.appearances,
      minutesPlayed: r.minutesPlayed,
      goals: r.goals,
      assists: r.assists,
      saves: r.saves,
      shotsOnTarget: r.shotsOnTarget,
      shotsOffTarget: r.shotsOffTarget,
      interceptions: r.interceptions,
      foulsCommitted: r.foulsCommitted,
      yellowCards: r.yellowCards,
      redCards: r.redCards,
      motm: r.motm,
    }));
    if (!prev.length && (m.resultStatus === "confirmed" || m.resultStatus === "amended")) {
      prev = next.map((l) => ({ ...l }));
    }
    const prevBy = new Map(prev.map((l) => [l.playerId, l]));

    // Fixed order, so two matches syncing together lock player rows consistently.
    const everyone = [...new Set([...nextBy.keys(), ...prevBy.keys()])].sort();
    let changed = 0;
    for (const pid of everyone) {
      const n = nextBy.get(pid) ?? emptyLine(pid, prevBy.get(pid)?.clubId ?? null);
      const p = prevBy.get(pid) ?? emptyLine(pid, n.clubId);
      const delta = diffLines(n, p);
      const clubId = n.clubId ?? p.clubId;
      if (isZeroDelta(delta)) {
        // numbers unchanged — still make sure the tournament row knows its club
        if (clubId) {
          const [row] = await tx
            .select({ id: playerStats.id, clubId: playerStats.clubId })
            .from(playerStats)
            .where(and(eq(playerStats.playerId, pid), eq(playerStats.tournamentId, m.tournamentId)))
            .limit(1);
          if (row && !row.clubId)
            await tx.update(playerStats).set({ clubId }).where(eq(playerStats.id, row.id));
        }
        continue;
      }
      await bumpStatRow(tx, { playerId: pid, tournamentId: null, season: "career", clubId: null, delta, weights });
      await bumpStatRow(tx, { playerId: pid, tournamentId: m.tournamentId, season, clubId, delta, weights });
      changed++;
    }

    await tx.delete(playerMatchStats).where(eq(playerMatchStats.matchId, matchId));
    if (next.length) {
      await tx.insert(playerMatchStats).values(next.map((l) => ({ matchId, ...l })));
    }
    return { players: changed };
  });
}
