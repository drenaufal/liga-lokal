import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { ageCategories, matchEvents, matchLineups, matches, players, tournaments, tournamentSquad, tournamentTeams } from "@/lib/db/schema";
import { DEFAULT_MATCH_MINUTES, clockCap, halfOf } from "@/lib/match-clock";
import { liveMinute, recomputeMatchScore } from "@/lib/match-engine";
import type { QuickType } from "@/lib/quick-events";

export { QUICK_TYPES, type QuickType } from "@/lib/quick-events";

const GOALS = ["goal", "penalty_goal"] as const;

/** Match length in minutes: set at kick-off, else the age-category rule, else 90. */
export async function matchDuration(m: { durationMinutes: number | null; tournamentId: string }) {
  if (m.durationMinutes) return m.durationMinutes;
  const [row] = await db
    .select({ rules: ageCategories.rules })
    .from(tournaments)
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(eq(tournaments.id, m.tournamentId));
  return row?.rules?.matchDuration ?? DEFAULT_MATCH_MINUTES;
}

export type QuickEventResult = {
  eventId: string;
  type: string;
  minute: number;
  /** The assist was tied to a goal (or the goal to an assist already recorded). */
  linked: boolean;
  playerName: string;
  jerseyNumber: number | null;
  tournamentId: string;
};

/**
 * Records one event for one player at the current match minute. The minute
 * comes from the match clock on the server, never from the browser.
 */
export async function recordQuickEvent(input: {
  matchId: string;
  clubId: string;
  playerId: string;
  type: QuickType;
  userId: string;
}): Promise<QuickEventResult> {
  const { matchId, clubId, playerId, userId } = input;
  let type: string = input.type;

  const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!m) throw new Error("Pertandingan tidak ditemukan");
  if (m.status === "scheduled") throw new Error("Mulai pertandingan terlebih dahulu.");
  if (m.status !== "live" && m.status !== "halftime")
    throw new Error("Pertandingan sudah selesai. Gunakan “Kejadian Tim” / ⋯ untuk koreksi.");
  if (clubId !== m.homeClubId && clubId !== m.awayClubId) throw new Error("Klub tidak ikut pertandingan ini");

  const [pl] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      jerseyNumber: players.jerseyNumber,
      clubId: players.clubId,
      secondClubId: players.secondClubId,
    })
    .from(players)
    .where(eq(players.id, playerId));
  if (!pl) throw new Error("Pemain tidak ditemukan");
  const [lineup] = await db
    .select({ clubId: matchLineups.clubId, shirt: matchLineups.shirtNumber })
    .from(matchLineups)
    .where(and(eq(matchLineups.matchId, matchId), eq(matchLineups.playerId, playerId)));
  const registrations = await db
    .select({ clubId: tournamentTeams.clubId, shirt: tournamentSquad.jerseyNumber })
    .from(tournamentSquad)
    .innerJoin(tournamentTeams, eq(tournamentTeams.id, tournamentSquad.tournamentTeamId))
    .where(and(eq(tournamentTeams.tournamentId, m.tournamentId), eq(tournamentSquad.playerId, playerId)));
  const registration = registrations.find((r) => r.clubId === clubId);
  const eligible = lineup
    ? lineup.clubId === clubId
    : registrations.length ? !!registration : pl.clubId === clubId || pl.secondClubId === clubId;
  if (!eligible) throw new Error("Pemain tidak terdaftar pada klub ini");

  // A player who has been sent off cannot do anything more.
  const cards = await db
    .select({ type: matchEvents.type })
    .from(matchEvents)
    .where(
      and(
        eq(matchEvents.matchId, matchId),
        eq(matchEvents.playerId, playerId),
        eq(matchEvents.voided, false),
        inArray(matchEvents.type, ["yellow_card", "red_card", "second_yellow"]),
      ),
    );
  if (cards.some((c) => c.type === "red_card" || c.type === "second_yellow"))
    throw new Error(`${pl.fullName} sudah dikeluarkan dari lapangan`);
  if (type === "yellow_card" && cards.some((c) => c.type === "yellow_card")) type = "second_yellow";

  const duration = await matchDuration(m);
  const half = halfOf(duration);
  let minute = liveMinute(m, clockCap(duration));
  let relatedPlayerId: string | null = null;
  let linkedGoalId: string | null = null;
  let linkedAssistId: string | null = null;

  if (type === "assist") {
    // An assist belongs to the club's latest goal that has none yet.
    const open = await db
      .select({ id: matchEvents.id, playerId: matchEvents.playerId, minute: matchEvents.minute })
      .from(matchEvents)
      .where(
        and(
          eq(matchEvents.matchId, matchId),
          eq(matchEvents.clubId, clubId),
          eq(matchEvents.voided, false),
          inArray(matchEvents.type, [...GOALS]),
          isNull(matchEvents.relatedPlayerId),
        ),
      )
      .orderBy(desc(matchEvents.createdAt));
    const goal = open.find((g) => g.playerId !== playerId);
    if (!goal && open.length) throw new Error("Pencetak gol tidak bisa mencatat assist untuk golnya sendiri");
    if (goal) {
      linkedGoalId = goal.id;
      relatedPlayerId = goal.playerId;
      minute = goal.minute; // pair at the goal's minute (voiding a goal finds its assist by minute)
    }
  } else if (type === "goal") {
    // …or the assist was tapped first: pair with a loose one from the last two minutes.
    const since = new Date(Date.now() - 2 * 60_000);
    const [loose] = await db
      .select({ id: matchEvents.id, playerId: matchEvents.playerId })
      .from(matchEvents)
      .where(
        and(
          eq(matchEvents.matchId, matchId),
          eq(matchEvents.clubId, clubId),
          eq(matchEvents.voided, false),
          eq(matchEvents.type, "assist"),
          isNull(matchEvents.relatedPlayerId),
          gte(matchEvents.createdAt, since),
        ),
      )
      .orderBy(desc(matchEvents.createdAt))
      .limit(1);
    if (loose && loose.playerId && loose.playerId !== playerId) {
      linkedAssistId = loose.id;
      relatedPlayerId = loose.playerId;
    }
  }

  const eventId = crypto.randomUUID();
  await db.insert(matchEvents).values({
    id: eventId,
    matchId,
    type: type as (typeof matchEvents.$inferInsert)["type"],
    minute,
    period: minute > half ? "second_half" : "first_half",
    clubId,
    playerId,
    relatedPlayerId,
    createdBy: userId,
  });

  if (linkedGoalId) {
    // the goal remembers who set it up
    await db.update(matchEvents).set({ relatedPlayerId: playerId }).where(eq(matchEvents.id, linkedGoalId));
  }
  if (linkedAssistId) {
    await db
      .update(matchEvents)
      .set({ relatedPlayerId: playerId, minute, period: minute > half ? "second_half" : "first_half" })
      .where(eq(matchEvents.id, linkedAssistId));
  }
  if (type === "goal") await recomputeMatchScore(matchId);

  return {
    eventId,
    type,
    minute,
    linked: !!(linkedGoalId || linkedAssistId),
    playerName: pl.fullName,
    jerseyNumber: lineup?.shirt ?? registration?.shirt ?? pl.jerseyNumber,
    tournamentId: m.tournamentId,
  };
}

/**
 * Takes back an event entered by mistake: removes it outright (a "void" would
 * leave a greyed-out row in the timeline) together with its paired goal/assist.
 * Only for fresh events of a match that is still in play.
 */
export async function undoQuickEvent(input: {
  matchId: string;
  eventId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const { matchId, eventId, userId, isAdmin } = input;
  const [ev] = await db
    .select()
    .from(matchEvents)
    .where(and(eq(matchEvents.id, eventId), eq(matchEvents.matchId, matchId)));
  if (!ev) throw new Error("Kejadian tidak ditemukan");
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!m) throw new Error("Pertandingan tidak ditemukan");
  if (m.status !== "live" && m.status !== "halftime")
    throw new Error("Pertandingan sudah selesai — batalkan lewat lini masa (kolom koreksi).");
  if (ev.createdBy !== userId && !isAdmin) throw new Error("Hanya pencatat kejadian atau admin yang dapat membatalkan");
  if (Date.now() - new Date(ev.createdAt).getTime() > 5 * 60_000)
    throw new Error("Batas batal cepat (5 menit) sudah lewat — gunakan tombol batalkan di lini masa.");

  if ((ev.type === "goal" || ev.type === "penalty_goal") && ev.playerId && ev.relatedPlayerId) {
    // the assist recorded with this goal goes too
    const [pair] = await db
      .select({ id: matchEvents.id })
      .from(matchEvents)
      .where(
        and(
          eq(matchEvents.matchId, matchId),
          eq(matchEvents.type, "assist"),
          eq(matchEvents.playerId, ev.relatedPlayerId),
          eq(matchEvents.relatedPlayerId, ev.playerId),
          eq(matchEvents.minute, ev.minute),
          eq(matchEvents.voided, false),
        ),
      )
      .limit(1);
    if (pair) await db.delete(matchEvents).where(eq(matchEvents.id, pair.id));
  } else if (ev.type === "assist" && ev.playerId && ev.relatedPlayerId) {
    // the goal it was tied to is left without an assister
    await db
      .update(matchEvents)
      .set({ relatedPlayerId: null })
      .where(
        and(
          eq(matchEvents.matchId, matchId),
          inArray(matchEvents.type, [...GOALS]),
          eq(matchEvents.playerId, ev.relatedPlayerId),
          eq(matchEvents.relatedPlayerId, ev.playerId),
          eq(matchEvents.minute, ev.minute),
        ),
      );
  }

  await db.delete(matchEvents).where(eq(matchEvents.id, eventId));
  if (ev.type === "goal" || ev.type === "penalty_goal" || ev.type === "own_goal") await recomputeMatchScore(matchId);
  return { tournamentId: m.tournamentId, type: ev.type, minute: ev.minute };
}
