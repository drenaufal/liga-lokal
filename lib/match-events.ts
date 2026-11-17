import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { ageCategories, matchEvents, matchLineups, matches, players, tournaments } from "@/lib/db/schema";
import { DEFAULT_MATCH_MINUTES, clockCap, halfOf } from "@/lib/match-clock";
import { liveMinute, recomputeMatchScore } from "@/lib/match-engine";
import type { QuickType, TeamCounterType } from "@/lib/quick-events";
import { assertPlaying } from "@/lib/match-participation";
import { QUICK_TYPES, TEAM_COUNTER_TYPES } from "@/lib/quick-events";
import { getSafeT } from "@/lib/i18n/server";

export { QUICK_TYPES, TEAM_COUNTER_TYPES, type QuickType, type TeamCounterType } from "@/lib/quick-events";

type MatchTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const GOALS = ["goal", "penalty_goal"] as const;

/** Match length in minutes: set at kick-off, else the age-category rule, else 90. */
export async function matchDuration(m: { durationMinutes: number | null; tournamentId: string }, executor: typeof db | MatchTx = db) {
  if (m.durationMinutes) return m.durationMinutes;
  const [row] = await executor
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
  const t = await getSafeT();
  return db.transaction(async (tx) => {
    const { matchId, clubId, playerId, userId } = input;
    let type: string = input.type;
    if (!(QUICK_TYPES as readonly string[]).includes(type)) throw new Error(t("Jenis kejadian tidak valid"));

    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!m) throw new Error(t("Pertandingan tidak ditemukan"));
    if (m.status === "scheduled") throw new Error(t("Mulai pertandingan terlebih dahulu."));
    if (m.status !== "live" && m.status !== "halftime")
      throw new Error(t("Pertandingan sudah selesai. Gunakan “Kejadian Tim” / ⋯ untuk koreksi."));
    if (clubId !== m.homeClubId && clubId !== m.awayClubId) throw new Error(t("Klub tidak ikut pertandingan ini"));

    const [pl] = await tx
      .select({
        id: players.id,
        fullName: players.fullName,
        jerseyNumber: players.jerseyNumber,
      })
      .from(players)
      .where(eq(players.id, playerId));
    if (!pl) throw new Error(t("Pemain tidak ditemukan"));
    const [lineup] = await tx
      .select({ clubId: matchLineups.clubId, shirt: matchLineups.shirtNumber })
      .from(matchLineups)
      .where(and(eq(matchLineups.matchId, matchId), eq(matchLineups.playerId, playerId)));
    if (!lineup || lineup.clubId !== clubId) throw new Error(t("Pemain tidak dipilih untuk pertandingan ini"));
    // A player who has been sent off cannot do anything more.
    const cards = await tx
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
      throw new Error(t("{name} sudah dikeluarkan dari lapangan", { name: pl.fullName }));
    if (type === "yellow_card" && cards.some((c) => c.type === "yellow_card")) type = "second_yellow";

    const duration = await matchDuration(m, tx);
    const half = halfOf(duration);
    let minute = liveMinute(m, clockCap(duration));
    const lineups = await tx.select().from(matchLineups).where(eq(matchLineups.matchId, matchId));
    const events = await tx.select().from(matchEvents).where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.voided, false)));
    assertPlaying(playerId, lineups, events, minute, t);
    let relatedPlayerId: string | null = null;
    let linkedGoalId: string | null = null;
    let linkedAssistId: string | null = null;

    if (type === "assist") {
      // An assist belongs to the club's latest goal that has none yet.
      const open = await tx
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
      if (!goal && open.length) throw new Error(t("Pencetak gol tidak bisa mencatat assist untuk golnya sendiri"));
      if (goal) {
        linkedGoalId = goal.id;
        relatedPlayerId = goal.playerId;
        minute = goal.minute; // pair at the goal's minute (voiding a goal finds its assist by minute)
      }
    } else if (type === "goal") {
      // …or the assist was tapped first: pair with a loose one from the last two minutes.
      const since = new Date(Date.now() - 2 * 60_000);
      const [loose] = await tx
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

    assertPlaying(playerId, lineups, events, minute, t);
    const eventId = crypto.randomUUID();
    await tx.insert(matchEvents).values({
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
      await tx.update(matchEvents).set({ relatedPlayerId: playerId }).where(eq(matchEvents.id, linkedGoalId));
    }
    if (linkedAssistId) {
      await tx
        .update(matchEvents)
        .set({ relatedPlayerId: playerId, minute, period: minute > half ? "second_half" : "first_half" })
        .where(eq(matchEvents.id, linkedAssistId));
    }
    if (type === "goal") await recomputeMatchScore(matchId, tx);

    return {
      eventId,
      type,
      minute,
      linked: !!(linkedGoalId || linkedAssistId),
      playerName: pl.fullName,
      jerseyNumber: lineup.shirt ?? pl.jerseyNumber,
      tournamentId: m.tournamentId,
    };
  });
}

/** A team counter can be changed while the match is in play, and corrected once it has finished. */
const TEAM_COUNTER_STATUSES = ["live", "halftime", "completed"];

/**
 * One tap on a team counter (foul, corner, pass): an event for the club with no player,
 * stamped with the match clock. Returns the club's new total for that counter.
 */
export async function recordTeamEvent(input: { matchId: string; clubId: string; type: TeamCounterType; userId: string }) {
  const t = await getSafeT();
  if (!(TEAM_COUNTER_TYPES as readonly string[]).includes(input.type)) throw new Error(t("Jenis kejadian tidak valid"));
  return db.transaction(async (tx) => {
    const { matchId, clubId, type, userId } = input;
    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!m) throw new Error(t("Pertandingan tidak ditemukan"));
    if (!TEAM_COUNTER_STATUSES.includes(m.status)) throw new Error(t("Mulai pertandingan terlebih dahulu."));
    if (clubId !== m.homeClubId && clubId !== m.awayClubId) throw new Error(t("Klub tidak ikut pertandingan ini"));
    const duration = await matchDuration(m, tx);
    const minute = liveMinute(m, clockCap(duration));
    await tx.insert(matchEvents).values({
      matchId,
      type,
      minute,
      period: minute > halfOf(duration) ? "second_half" : "first_half",
      clubId,
      playerId: null,
      createdBy: userId,
    });
    return { minute, count: await teamCount(tx, matchId, clubId, type), tournamentId: m.tournamentId };
  });
}

/** The "−" next to a team counter: removes the club's latest team-level event of that kind. */
export async function removeLastTeamEvent(input: { matchId: string; clubId: string; type: TeamCounterType }) {
  const t = await getSafeT();
  if (!(TEAM_COUNTER_TYPES as readonly string[]).includes(input.type)) throw new Error(t("Jenis kejadian tidak valid"));
  return db.transaction(async (tx) => {
    const { matchId, clubId, type } = input;
    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!m) throw new Error(t("Pertandingan tidak ditemukan"));
    if (!TEAM_COUNTER_STATUSES.includes(m.status)) throw new Error(t("Mulai pertandingan terlebih dahulu."));
    const [last] = await tx
      .select({ id: matchEvents.id, minute: matchEvents.minute })
      .from(matchEvents)
      .where(
        and(
          eq(matchEvents.matchId, matchId),
          eq(matchEvents.clubId, clubId),
          eq(matchEvents.type, type),
          eq(matchEvents.voided, false),
          isNull(matchEvents.playerId),
        ),
      )
      .orderBy(desc(matchEvents.createdAt))
      .limit(1);
    if (!last) throw new Error(t("Tidak ada catatan tim yang bisa dikurangi."));
    await tx.delete(matchEvents).where(eq(matchEvents.id, last.id));
    return { minute: last.minute, count: await teamCount(tx, matchId, clubId, type), tournamentId: m.tournamentId };
  });
}

async function teamCount(tx: MatchTx, matchId: string, clubId: string, type: TeamCounterType) {
  return tx.$count(
    matchEvents,
    and(eq(matchEvents.matchId, matchId), eq(matchEvents.clubId, clubId), eq(matchEvents.type, type), eq(matchEvents.voided, false)),
  );
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
  const t = await getSafeT();
  return db.transaction(async (tx) => {
    const { matchId, eventId, userId, isAdmin } = input;
    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!m) throw new Error(t("Pertandingan tidak ditemukan"));
    const [ev] = await tx
      .select()
      .from(matchEvents)
      .where(and(eq(matchEvents.id, eventId), eq(matchEvents.matchId, matchId)));
    if (!ev) throw new Error(t("Kejadian tidak ditemukan"));

    if (m.status !== "live" && m.status !== "halftime")
      throw new Error(t("Pertandingan sudah selesai — batalkan lewat lini masa (kolom koreksi)."));
    if (ev.createdBy !== userId && !isAdmin) throw new Error(t("Hanya pencatat kejadian atau admin yang dapat membatalkan"));
    if (Date.now() - new Date(ev.createdAt).getTime() > 5 * 60_000)
      throw new Error(t("Batas batal cepat (5 menit) sudah lewat — gunakan tombol batalkan di lini masa."));

    if ((ev.type === "goal" || ev.type === "penalty_goal") && ev.playerId && ev.relatedPlayerId) {
      // the assist recorded with this goal goes too
      const [pair] = await tx
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
      if (pair) await tx.delete(matchEvents).where(eq(matchEvents.id, pair.id));
    } else if (ev.type === "assist" && ev.playerId && ev.relatedPlayerId) {
      // the goal it was tied to is left without an assister
      await tx
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

    await tx.delete(matchEvents).where(eq(matchEvents.id, eventId));
    if (ev.type === "goal" || ev.type === "penalty_goal" || ev.type === "own_goal") await recomputeMatchScore(matchId, tx);
    return { tournamentId: m.tournamentId, type: ev.type, minute: ev.minute };
  });
}
