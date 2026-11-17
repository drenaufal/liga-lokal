import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchEvents, matchLineups, matches } from "@/lib/db/schema";
import { assertPlaying, assertSubstitution, assertParticipationHistory } from "@/lib/match-participation";
import { matchDuration } from "@/lib/match-events";
import { halfOf } from "@/lib/match-clock";
import { recomputeMatchScore } from "@/lib/match-engine";
import { getSafeT } from "@/lib/i18n/server";

export async function recordManualMatchEvent(v: {
  matchId: string; type: (typeof matchEvents.$inferInsert)["type"]; clubId: string;
  playerId?: string; relatedPlayerId?: string; minute: number; note?: string;
}, userId: string) {
  const t = await getSafeT();
  if (v.type === "save") throw new Error(t("Penyelamatan dihitung otomatis dari tembakan tepat sasaran lawan."));
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(matches).where(eq(matches.id, v.matchId)).for("update");
    if (!m || !["live", "halftime", "completed"].includes(m.status)) throw new Error(t("Mulai pertandingan terlebih dahulu."));
    if (v.clubId !== m.homeClubId && v.clubId !== m.awayClubId) throw new Error(t("Tim tidak ikut pertandingan ini."));
    const lineups = await tx.select().from(matchLineups).where(eq(matchLineups.matchId, v.matchId));
    const events = await tx.select().from(matchEvents).where(and(eq(matchEvents.matchId, v.matchId), eq(matchEvents.voided, false)));
    if (!["corner", "offside"].includes(v.type) && !v.playerId) throw new Error(t("Pilih pemain terlebih dahulu."));
    for (const id of [v.playerId, v.relatedPlayerId].filter(Boolean)) {
      if (!lineups.some((p) => p.playerId === id && p.clubId === v.clubId)) throw new Error(t("Pemain tidak dipilih untuk pertandingan ini."));
    }
    if (v.type === "substitution") assertSubstitution(v.playerId!, v.relatedPlayerId, v.clubId, lineups, events, v.minute, t);
    else if (v.playerId) assertPlaying(v.playerId, lineups, events, v.minute, t);
    if (v.type === "goal" && v.relatedPlayerId) {
      if (v.relatedPlayerId === v.playerId) throw new Error(t("Pencetak gol tidak dapat memberi assist untuk dirinya sendiri."));
      assertPlaying(v.relatedPlayerId, lineups, events, v.minute, t);
    }
    // Cards are recorded here (the ⋯ form): a player's second yellow is a dismissal.
    let type = v.type;
    if (type === "yellow_card" && v.playerId && events.some((e) => e.playerId === v.playerId && e.type === "yellow_card")) type = "second_yellow";
    const half = halfOf(await matchDuration(m, tx));
    const row = { matchId: v.matchId, type, minute: v.minute, period: v.minute > half ? "second_half" as const : "first_half" as const, clubId: v.clubId,
      playerId: v.playerId || null, relatedPlayerId: v.relatedPlayerId || null, createdAt: new Date(), createdBy: userId, detail: v.note ? { note: v.note } : undefined };
    if (v.type === "substitution") assertParticipationHistory(lineups, [...events, row], t);
    await tx.insert(matchEvents).values(row);
    if (v.type === "goal" && v.relatedPlayerId) await tx.insert(matchEvents).values({ ...row, type: "assist", playerId: v.relatedPlayerId, relatedPlayerId: v.playerId! });
    if (["goal", "penalty_goal", "own_goal"].includes(v.type)) await recomputeMatchScore(v.matchId, tx);
    return m;
  });
}

export async function voidManualMatchEvent(matchId: string, eventId: string, reason: string) {
  const t = await getSafeT();
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!m) throw new Error(t("Pertandingan tidak ditemukan."));
    const [ev] = await tx.select().from(matchEvents).where(and(eq(matchEvents.id, eventId), eq(matchEvents.matchId, matchId)));
    if (!ev) throw new Error(t("Kejadian tidak ditemukan dalam pertandingan ini."));
    if (ev.type === "substitution") {
      const lineups = await tx.select().from(matchLineups).where(eq(matchLineups.matchId, matchId));
      const remaining = await tx.select().from(matchEvents).where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.voided, false)));
      try { assertParticipationHistory(lineups, remaining.filter((e) => e.id !== eventId), t); }
      catch { throw new Error(t("Batalkan kejadian pemain yang bergantung pada pergantian ini terlebih dahulu.")); }
    }
    await tx.update(matchEvents).set({ voided: true, voidReason: reason }).where(eq(matchEvents.id, eventId));
    if ((ev.type === "goal" || ev.type === "penalty_goal") && ev.playerId && ev.relatedPlayerId) {
      await tx.update(matchEvents).set({ voided: true, voidReason: reason }).where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.type, "assist"),
        eq(matchEvents.playerId, ev.relatedPlayerId), eq(matchEvents.relatedPlayerId, ev.playerId), eq(matchEvents.minute, ev.minute), eq(matchEvents.voided, false)));
    } else if (ev.type === "assist" && ev.playerId && ev.relatedPlayerId) {
      await tx.update(matchEvents).set({ relatedPlayerId: null }).where(and(eq(matchEvents.matchId, matchId), inArray(matchEvents.type, ["goal", "penalty_goal"]),
        eq(matchEvents.playerId, ev.relatedPlayerId), eq(matchEvents.relatedPlayerId, ev.playerId), eq(matchEvents.minute, ev.minute)));
    }
    await recomputeMatchScore(matchId, tx);
    return m;
  });
}
