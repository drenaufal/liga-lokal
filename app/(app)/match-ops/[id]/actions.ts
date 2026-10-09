"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray, lte, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clubs,
  matchEvents,
  matches,
  referees,
  scoringFormulas,
  standings,
  tournamentTeams,
  users,
} from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { liveMinute, recomputeMatchScore, syncMatchStats } from "@/lib/match-engine";
import {
  QUICK_TYPES,
  matchDuration,
  recordQuickEvent,
  undoQuickEvent,
  type QuickType,
} from "@/lib/match-events";
import {
  DEFAULT_TIEBREAKERS,
  computeStandings,
  type MatchResultInput,
} from "@/lib/standings";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import {
  MAX_MATCH_MINUTES,
  MIN_MATCH_MINUTES,
  clockCap,
  halfOf,
} from "@/lib/match-clock";
import { EVENT_LABEL, licenseStatus } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";

async function loadMatch(id: string) {
  const m = await db.query.matches.findFirst({ where: eq(matches.id, id) });
  if (!m) throw new Error("Pertandingan tidak ditemukan");
  return m;
}

function rev(id: string, tournamentId?: string) {
  revalidatePath(`/match-ops/${id}`);
  revalidatePath("/match-ops");
  revalidatePath("/command-center");
  if (tournamentId) revalidatePath(`/kompetisi/${tournamentId}`, "layout");
}

/* ── Penugasan wasit & operator ─────────────────────────────────────────── */

/** Other matches within two hours that already use this referee or operator. */
async function assignmentConflicts(
  m: { id: string; scheduledAt: Date },
  refereeId: string | null,
  operatorId: string | null,
) {
  if (!refereeId && !operatorId) return [];
  const hc = alias(clubs, "hc");
  const ac = alias(clubs, "ac");
  const lo = new Date(m.scheduledAt.getTime() - 2 * 3_600_000);
  const hi = new Date(m.scheduledAt.getTime() + 2 * 3_600_000);
  const rows = await db
    .select({
      scheduledAt: matches.scheduledAt,
      refereeId: matches.refereeId,
      operatorId: matches.operatorId,
      home: hc.shortName,
      away: ac.shortName,
    })
    .from(matches)
    .leftJoin(hc, eq(hc.id, matches.homeClubId))
    .leftJoin(ac, eq(ac.id, matches.awayClubId))
    .where(
      and(
        ne(matches.id, m.id),
        gte(matches.scheduledAt, lo),
        lte(matches.scheduledAt, hi),
        inArray(matches.status, ["scheduled", "live", "halftime"]),
        or(
          refereeId ? eq(matches.refereeId, refereeId) : undefined,
          operatorId ? eq(matches.operatorId, operatorId) : undefined,
        ),
      ),
    );
  const out: string[] = [];
  for (const r of rows) {
    const where = `${r.home ?? "?"} vs ${r.away ?? "?"} (${formatDateTime(r.scheduledAt)})`;
    if (refereeId && r.refereeId === refereeId) out.push(`Wasit juga bertugas di ${where}`);
    if (operatorId && r.operatorId === operatorId) out.push(`Operator juga bertugas di ${where}`);
  }
  return out;
}

/** Assign (or change) the referee and operator. Allowed until the match kicks off. */
export async function assignOfficials(formData: FormData) {
  const user = await actionUser("match:assign");
  const matchId = String(formData.get("matchId"));
  const refereeId = String(formData.get("refereeId") ?? "") || null;
  const operatorId = String(formData.get("operatorId") ?? "") || null;
  const m = await loadMatch(matchId);
  if (m.status !== "scheduled") throw new Error("Penugasan hanya bisa diubah sebelum pertandingan dimulai");

  let refereeName: string | null = null;
  if (refereeId) {
    const [r] = await db.select().from(referees).where(eq(referees.id, refereeId));
    if (!r) throw new Error("Wasit tidak ditemukan");
    const st = licenseStatus(r.licenseExpiry, r.status === "revoked");
    if (st === "expired" || st === "revoked")
      throw new Error(`Lisensi ${r.fullName} ${st === "expired" ? "sudah kedaluwarsa" : "telah dicabut"}`);
    refereeName = r.fullName;
  }
  let operatorName: string | null = null;
  if (operatorId) {
    const [o] = await db
      .select({ name: users.name, role: users.role, active: users.active })
      .from(users)
      .where(eq(users.id, operatorId));
    if (!o || !o.active) throw new Error("Operator tidak ditemukan");
    if (o.role !== "operator" && o.role !== "admin") throw new Error("Pengguna ini bukan operator kompetisi");
    operatorName = o.name;
  }

  await db.update(matches).set({ refereeId, operatorId, updatedAt: new Date() }).where(eq(matches.id, matchId));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "match.assign",
    entityType: "match",
    entityId: matchId,
    summary: `Penugasan: wasit ${refereeName ?? "—"}, operator ${operatorName ?? "—"}`,
    before: { refereeId: m.refereeId, operatorId: m.operatorId },
    after: { refereeId, operatorId },
  });
  rev(matchId, m.tournamentId);
  return { warnings: await assignmentConflicts(m, refereeId, operatorId) };
}

/* ── Jalannya pertandingan ──────────────────────────────────────────────── */

export async function startMatch(id: string, durationMinutes: number) {
  const user = await actionUser("match:operate");
  const m = await loadMatch(id);
  if (m.status === "completed") throw new Error("Pertandingan sudah selesai");
  if (m.status !== "scheduled") throw new Error("Pertandingan sudah dimulai");
  if (!m.refereeId || !m.operatorId)
    throw new Error("Tugaskan wasit dan operator terlebih dahulu sebelum memulai pertandingan.");
  const duration = Math.round(Number(durationMinutes));
  if (!Number.isFinite(duration) || duration < MIN_MATCH_MINUTES || duration > MAX_MATCH_MINUTES) {
    throw new Error(`Durasi harus antara ${MIN_MATCH_MINUTES} dan ${MAX_MATCH_MINUTES} menit`);
  }

  await db
    .update(matches)
    .set({
      status: "live",
      period: "first_half",
      clockStartedAt: new Date(),
      currentMinute: 0,
      durationMinutes: duration,
      updatedAt: new Date(),
    })
    .where(eq(matches.id, id));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "match.start",
    entityType: "match",
    entityId: id,
    summary: `Pertandingan dimulai (kick-off), durasi ${duration} menit`,
  });
  rev(id, m.tournamentId);
}

export async function pauseClock(id: string) {
  const user = await actionUser("match:operate");
  const m = await loadMatch(id);
  const duration = await matchDuration(m);
  const minute = liveMinute(m, clockCap(duration));
  await db
    .update(matches)
    .set({ clockStartedAt: null, currentMinute: minute, status: "halftime", period: "halftime" })
    .where(eq(matches.id, id));
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.pause", entityType: "match", entityId: id,
    summary: `Waktu dihentikan pada menit ${minute}`,
  });
  rev(id, m.tournamentId);
}

export async function resumeSecondHalf(id: string) {
  const user = await actionUser("match:operate");
  const m = await loadMatch(id);
  const half = (m.homeScoreHt == null);
  const duration = await matchDuration(m);
  await db
    .update(matches)
    .set({
      status: "live",
      period: "second_half",
      clockStartedAt: new Date(),
      currentMinute: Math.max(m.currentMinute, halfOf(duration)),
      homeScoreHt: half ? m.homeScore : m.homeScoreHt,
      awayScoreHt: half ? m.awayScore : m.awayScoreHt,
    })
    .where(eq(matches.id, id));
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.resume", entityType: "match", entityId: id,
    summary: "Babak kedua dimulai",
  });
  rev(id, m.tournamentId);
}

export async function endMatch(id: string) {
  const user = await actionUser("match:operate");
  const m = await loadMatch(id);
  const duration = await matchDuration(m);
  const minute = liveMinute(m, clockCap(duration));
  await db
    .update(matches)
    .set({
      status: "completed",
      period: "full_time",
      clockStartedAt: null,
      currentMinute: minute,
      updatedAt: new Date(),
    })
    .where(eq(matches.id, id));
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.end", entityType: "match", entityId: id,
    summary: `Pertandingan berakhir ${m.homeScore}-${m.awayScore} pada menit ${minute}`,
  });
  rev(id, m.tournamentId);
}

/* ── Kejadian ───────────────────────────────────────────────────────────── */

const eventSchema = z.object({
  matchId: z.string(),
  type: z.enum([
    "goal", "penalty_goal", "own_goal", "assist", "save", "yellow_card",
    "red_card", "second_yellow", "foul", "corner", "offside", "substitution",
    "shot_on", "shot_off", "injury", "interception",
  ]),
  clubId: z.string(),
  playerId: z.string().optional(),
  relatedPlayerId: z.string().optional(),
  minute: z.coerce.number().int().min(0).max(130),
  note: z.string().optional(),
});

export async function addEvent(formData: FormData) {
  const user = await actionUser("match:operate");
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Data kejadian tidak valid");
  const v = parsed.data;
  const m = await loadMatch(v.matchId);
  const half = halfOf(await matchDuration(m));
  const period = v.minute > half ? "second_half" : "first_half";

  await db.insert(matchEvents).values({
    matchId: v.matchId,
    type: v.type,
    minute: v.minute,
    period,
    clubId: v.clubId,
    playerId: v.playerId || null,
    relatedPlayerId: v.relatedPlayerId || null,
    detail: v.note ? { note: v.note } : undefined,
    createdBy: user.id,
  });

  // A goal's assister is stored on the goal (relatedPlayerId) *and* as its own
  // "assist" event — the latter is what player statistics count.
  if (v.type === "goal" && v.playerId && v.relatedPlayerId) {
    await db.insert(matchEvents).values({
      matchId: v.matchId,
      type: "assist",
      minute: v.minute,
      period,
      clubId: v.clubId,
      playerId: v.relatedPlayerId,
      relatedPlayerId: v.playerId,
      createdBy: user.id,
    });
  }

  if (["goal", "penalty_goal", "own_goal"].includes(v.type)) {
    await recomputeMatchScore(v.matchId);
  }

  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.event.create", entityType: "match", entityId: v.matchId,
    summary: `Kejadian dicatat: ${v.type} menit ${v.minute}`,
  });
  rev(v.matchId, m.tournamentId);
}

/**
 * One tap on a player's row: records the event at the current match minute and
 * puts it on the timeline straight away. Returns what was recorded so the page
 * can offer "Batalkan".
 */
export async function quickEvent(input: { matchId: string; clubId: string; playerId: string; type: string }) {
  const user = await actionUser("match:operate");
  if (!(QUICK_TYPES as readonly string[]).includes(input.type)) throw new Error("Jenis kejadian tidak valid");
  const r = await recordQuickEvent({
    matchId: input.matchId,
    clubId: input.clubId,
    playerId: input.playerId,
    type: input.type as QuickType,
    userId: user.id,
  });
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.event.create", entityType: "match", entityId: input.matchId,
    summary: `${EVENT_LABEL[r.type] ?? r.type} — ${r.jerseyNumber ? `#${r.jerseyNumber} ` : ""}${r.playerName}, menit ${r.minute}`,
  });
  rev(input.matchId, r.tournamentId);
  return {
    eventId: r.eventId,
    type: r.type,
    minute: r.minute,
    linked: r.linked,
    playerName: r.playerName,
    jerseyNumber: r.jerseyNumber,
  };
}

/** "Batalkan" on the toast that follows a quick event. */
export async function undoEvent(input: { matchId: string; eventId: string }) {
  const user = await actionUser("match:operate");
  const r = await undoQuickEvent({
    matchId: input.matchId,
    eventId: input.eventId,
    userId: user.id,
    isAdmin: user.role === "admin",
  });
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.event.undo", entityType: "match", entityId: input.matchId,
    summary: `Kejadian ${EVENT_LABEL[r.type] ?? r.type} menit ${r.minute} dibatalkan (salah catat)`,
  });
  rev(input.matchId, r.tournamentId);
}

export async function voidEvent(formData: FormData) {
  const user = await actionUser("match:operate");
  const eventId = String(formData.get("eventId"));
  const matchId = String(formData.get("matchId"));
  const reason = String(formData.get("reason") ?? "Koreksi operator");

  await db
    .update(matchEvents)
    .set({ voided: true, voidReason: reason })
    .where(eq(matchEvents.id, eventId));
  const [ev] = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId));

  // voiding a goal also voids the assist recorded with it
  if (ev && (ev.type === "goal" || ev.type === "penalty_goal") && ev.playerId && ev.relatedPlayerId) {
    await db
      .update(matchEvents)
      .set({ voided: true, voidReason: reason })
      .where(
        and(
          eq(matchEvents.matchId, matchId),
          eq(matchEvents.type, "assist"),
          eq(matchEvents.playerId, ev.relatedPlayerId),
          eq(matchEvents.relatedPlayerId, ev.playerId),
          eq(matchEvents.minute, ev.minute),
          eq(matchEvents.voided, false),
        ),
      );
  }
  // …and voiding an assist leaves its goal without an assister
  if (ev && ev.type === "assist" && ev.playerId && ev.relatedPlayerId) {
    await db
      .update(matchEvents)
      .set({ relatedPlayerId: null })
      .where(
        and(
          eq(matchEvents.matchId, matchId),
          inArray(matchEvents.type, ["goal", "penalty_goal"]),
          eq(matchEvents.playerId, ev.relatedPlayerId),
          eq(matchEvents.relatedPlayerId, ev.playerId),
          eq(matchEvents.minute, ev.minute),
        ),
      );
  }

  await recomputeMatchScore(matchId);
  const m = await loadMatch(matchId);
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.event.void", entityType: "match", entityId: matchId,
    summary: `Kejadian dibatalkan — ${reason}`,
  });
  rev(matchId, m.tournamentId);
}

/* ── Hasil & statistik ──────────────────────────────────────────────────── */

async function activeWeights() {
  const f = await db.query.scoringFormulas.findFirst({
    where: eq(scoringFormulas.isActive, true),
  });
  return f?.weights ?? DEFAULT_WEIGHTS;
}

async function recomputeTournamentStandings(tournamentId: string) {
  const t = await db.query.tournaments.findFirst({
    where: (tt, { eq: e }) => e(tt.id, tournamentId),
  });
  if (!t || t.format === "knockout") return;

  const teams = await db
    .select({ clubId: tournamentTeams.clubId, group: tournamentTeams.groupLabel })
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, tournamentId));
  const groupsByClub = Object.fromEntries(teams.map((x) => [x.clubId, x.group ?? "-"]));

  const done = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), eq(matches.status, "completed")));
  const ids = done.map((m) => m.id);
  const evs = ids.length
    ? await db.select().from(matchEvents).where(inArray(matchEvents.matchId, ids))
    : [];

  const results: MatchResultInput[] = done
    .filter((m) => m.homeClubId && m.awayClubId)
    .map((m) => ({
      homeClubId: m.homeClubId!,
      awayClubId: m.awayClubId!,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      groupLabel: m.groupLabel,
      homeYellow: evs.filter((e) => e.matchId === m.id && e.type === "yellow_card" && e.clubId === m.homeClubId && !e.voided).length,
      awayYellow: evs.filter((e) => e.matchId === m.id && e.type === "yellow_card" && e.clubId === m.awayClubId && !e.voided).length,
      homeRed: evs.filter((e) => e.matchId === m.id && e.type === "red_card" && e.clubId === m.homeClubId && !e.voided).length,
      awayRed: evs.filter((e) => e.matchId === m.id && e.type === "red_card" && e.clubId === m.awayClubId && !e.voided).length,
    }));

  const rows = computeStandings(
    teams.map((x) => x.clubId),
    results,
    { pointsWin: t.pointsWin, pointsDraw: t.pointsDraw, pointsLoss: t.pointsLoss, tiebreakers: t.tiebreakers ?? DEFAULT_TIEBREAKERS },
    groupsByClub,
  );

  await db.delete(standings).where(eq(standings.tournamentId, tournamentId));
  if (rows.length) {
    await db.insert(standings).values(
      rows.map((r) => ({
        tournamentId,
        clubId: r.clubId,
        groupLabel: r.groupLabel,
        played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
        goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst,
        points: r.points, fairPlayPoints: r.fairPlayPoints, form: r.form, rank: r.rank,
      })),
    );
  }
}

export async function confirmResult(formData: FormData) {
  const user = await actionUser("match:confirm");
  const id = String(formData.get("id"));
  const m = await loadMatch(id);
  if (m.status !== "completed") throw new Error("Selesaikan pertandingan terlebih dahulu");

  // Idempotent: confirming again only applies what changed since last time.
  await syncMatchStats(id, await activeWeights());

  await db
    .update(matches)
    .set({
      resultStatus: "confirmed",
      confirmedBy: user.id,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(matches.id, id));

  await recomputeTournamentStandings(m.tournamentId);

  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.confirm", entityType: "match", entityId: id,
    summary: `Hasil ${m.homeScore}-${m.awayScore} dikonfirmasi; klasemen & statistik diperbarui`,
  });
  rev(id, m.tournamentId);
}

export async function amendResult(formData: FormData) {
  const user = await actionUser("match:confirm");
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("Alasan koreksi wajib diisi");
  const m = await loadMatch(id);

  // Scoreline from the current events, then only the difference in player stats.
  await recomputeMatchScore(id);
  await syncMatchStats(id, await activeWeights());

  await db
    .update(matches)
    .set({
      resultStatus: "amended",
      amendmentReason: reason,
      confirmedBy: user.id,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(matches.id, id));

  await recomputeTournamentStandings(m.tournamentId);

  const after = await loadMatch(id);
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.amend", entityType: "match", entityId: id,
    summary: `Hasil dikoreksi menjadi ${after.homeScore}-${after.awayScore} — ${reason}`,
  });
  rev(id, m.tournamentId);
}

