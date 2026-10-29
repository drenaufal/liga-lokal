"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ageCategories,
  tournaments,
  matchEvents,
  matchDspSubmissions,
  matchLineups,
  matches,
  scoringFormulas,
  standings,
  tournamentTeams,
} from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { auditText, recordAudit } from "@/lib/audit";
import { liveMinute, recomputeMatchScore, syncMatchStats } from "@/lib/match-engine";
import { advanceCupWinner, isCupStage } from "@/lib/cup-advance";
import { matchWinnerSide } from "@/lib/fixtures";
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
import { normalizeWeights } from "@/lib/scoring";
import {
  clockCap,
  halfOf,
} from "@/lib/match-clock";
import { EVENT_LABEL } from "@/lib/status";
import { officialAssignmentConflicts, saveMatchOfficials, startAssignedMatch } from "@/lib/match-officials";
import { recordManualMatchEvent, voidManualMatchEvent } from "@/lib/manual-match-events";
import { getEligibleMatchPlayers } from "@/lib/queries/match-roster";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

export async function saveMatchSquad(matchId: string, playerIds: string[], starterIds?: string[]) {
  const t = await getT();
  const user = await actionUser("match:squad");
  const ids = z.array(z.string().uuid()).min(2).max(200).parse(playerIds);
  const starters = starterIds ? z.array(z.string().uuid()).parse(starterIds) : undefined;
  if (starters?.some((id) => !ids.includes(id))) throw new Error(t("Starter harus termasuk pemain yang dipilih."));
  const m = await loadMatch(matchId);
  const [ku] = await db.select({ rules: ageCategories.rules }).from(tournaments)
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId)).where(eq(tournaments.id, m.tournamentId));
  const onField = ku?.rules?.playersOnField;
  const clubIds = [m.homeClubId, m.awayClubId].filter(Boolean) as string[];
  const eligible = await getEligibleMatchPlayers(m.tournamentId, clubIds);
  if (clubIds.length !== 2 || new Set(ids).size !== ids.length || ids.some((id) => !eligible.some((p) => p.id === id)) ||
      clubIds.some((clubId) => !eligible.some((p) => p.clubId === clubId && ids.includes(p.id))))
    throw new Error(t("Pilih pemain yang sesuai untuk kedua tim."));
  await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!locked || locked.status !== "scheduled") throw new Error(t("Pemain hanya dapat dipilih sebelum pertandingan dimulai."));
    const previous = await tx.select().from(matchLineups).where(eq(matchLineups.matchId, matchId));
    await tx.delete(matchLineups).where(eq(matchLineups.matchId, matchId));
    const next = ids.map((playerId) => {
      const p = eligible.find((p) => p.id === playerId)!;
      const saved = previous.find((l) => l.playerId === playerId && l.clubId === p.clubId);
      return { matchId, clubId: p.clubId, playerId, shirtNumber: saved?.shirtNumber ?? p.jersey,
        role: starters ? (starters.includes(playerId) ? "starter" as const : "substitute" as const) : saved?.role ?? "starter", isCaptain: saved?.isCaptain ?? false,
        slot: saved?.slot ?? (p.position === "GK" ? "GK" : null), x: saved?.x, y: saved?.y };
    });
    if (clubIds.some((clubId) => !next.some((p) => p.clubId === clubId && p.role === "starter"))) throw new Error(t("Pilih minimal satu starter untuk setiap tim."));
    if (clubIds.some((clubId) => next.filter((p) => p.clubId === clubId && p.role === "starter" && p.slot === "GK").length > 1)) throw new Error(t("Pilih satu kiper sebagai starter untuk setiap tim."));
    if (onField && clubIds.some((clubId) => next.filter((p) => p.clubId === clubId && p.role === "starter").length > onField)) throw new Error(t("Maksimal {n} starter untuk setiap tim sesuai aturan KU.", { n: onField }));
    await tx.insert(matchLineups).values(next);
    for (const clubId of clubIds) {
      // only the starting XI invalidates a coach's DSP: cadangan are whoever is left over
      const key = (rows: { playerId: string; role: string; clubId: string }[]) => rows.filter((p) => p.clubId === clubId && p.role === "starter").map((p) => p.playerId).sort().join(",");
      if (key(previous) !== key(next)) await tx.delete(matchDspSubmissions).where(and(eq(matchDspSubmissions.matchId, matchId), eq(matchDspSubmissions.clubId, clubId)));
    }
  });
  await recordAudit({ actorId: user.id, actorName: user.name, actorRole: user.role, action: "match.squad", entityType: "match", entityId: matchId, summary: auditText("Pemain pertandingan dipilih: {n} pemain", { n: ids.length }) });
  rev(matchId, m.tournamentId);
}

async function loadMatch(id: string) {
  const t = await getT();
  const m = await db.query.matches.findFirst({ where: eq(matches.id, id) });
  if (!m) throw new Error(t("Pertandingan tidak ditemukan"));
  return m;
}

function rev(id: string, tournamentId?: string) {
  revalidatePath(`/match-ops/${id}`);
  revalidatePath("/match-ops");
  revalidatePath("/command-center");
  // the KU's own pages and the Turnamen above it both show results and progress
  if (tournamentId) {
    revalidatePath(`/kompetisi/ku/${tournamentId}`, "layout");
    revalidatePath("/kompetisi", "layout");
  }
}

/* ── Penugasan wasit & operator ─────────────────────────────────────────── */

/** Assign one referee and any number of operators before kick-off. */
export async function assignOfficials(formData: FormData) {
  const user = await actionUser("match:assign");
  const matchId = String(formData.get("matchId") ?? "");
  const refereeId = String(formData.get("refereeId") ?? "") || null;
  // Accept the former field as well for a console that was opened before an update.
  const values = formData.has("operatorIds") ? formData.getAll("operatorIds") : formData.getAll("operatorId");
  const operatorIds = values.map(String).filter(Boolean);
  const result = await saveMatchOfficials({ matchId, refereeId, operatorIds });
  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "match.assign",
    entityType: "match",
    entityId: matchId,
    summary: auditText("Penugasan: wasit {referee}, operator {operators}", { referee: result.refereeName ?? "—", operators: result.operators.map((o) => o.name).join(", ") || "—" }),
    before: result.before,
    after: result.after,
  });
  rev(matchId, result.match.tournamentId);
  return { warnings: await officialAssignmentConflicts(result.match, refereeId, result.operators) };
}

/* ── Jalannya pertandingan ──────────────────────────────────────────────── */

export async function startMatch(id: string, durationMinutes: number) {
  const user = await actionUser("match:operate");
  const m = await startAssignedMatch(id, durationMinutes);

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "match.start",
    entityType: "match",
    entityId: id,
    summary: auditText("Pertandingan dimulai (kick-off), durasi {n} menit", { n: m.durationMinutes }),
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
    summary: auditText("Waktu dihentikan pada menit {n}", { n: minute }),
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
    summary: auditText("Babak kedua dimulai"),
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
    summary: auditText("Pertandingan berakhir {a}-{b} pada menit {n}", { a: m.homeScore, b: m.awayScore, n: minute }),
  });
  rev(id, m.tournamentId);
}

/* ── Kejadian ───────────────────────────────────────────────────────────── */

const eventSchema = z.object({
  matchId: z.string(),
  type: z.enum([
    "goal", "penalty_goal", "own_goal", "assist", "yellow_card",
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
  const t = await getT();
  const user = await actionUser("match:events");
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(t("Data kejadian tidak valid"));
  const v = parsed.data;
  const m = await recordManualMatchEvent(v, user.id);

  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.event.create", entityType: "match", entityId: v.matchId,
    summary: auditText("Kejadian dicatat: {type} menit {n}", { type: v.type, n: v.minute }),
  });
  rev(v.matchId, m.tournamentId);
}

/**
 * One tap on a player's row: records the event at the current match minute and
 * puts it on the timeline straight away. Returns what was recorded so the page
 * can offer "Batalkan".
 */
export async function quickEvent(input: { matchId: string; clubId: string; playerId: string; type: string }) {
  const t = await getT();
  const user = await actionUser("match:events");
  if (!(QUICK_TYPES as readonly string[]).includes(input.type)) throw new Error(t("Jenis kejadian tidak valid"));
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
    summary: auditText("{event} — {player}, menit {n}", { event: EVENT_LABEL[r.type] ?? r.type, player: (r.jerseyNumber ? "#" + r.jerseyNumber + " " : "") + r.playerName, n: r.minute }),
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
  const user = await actionUser("match:events");
  const r = await undoQuickEvent({
    matchId: input.matchId,
    eventId: input.eventId,
    userId: user.id,
    isAdmin: can(user, "match:undo-any"),
  });
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.event.undo", entityType: "match", entityId: input.matchId,
    summary: auditText("Kejadian {event} menit {n} dibatalkan (salah catat)", { event: EVENT_LABEL[r.type] ?? r.type, n: r.minute }),
  });
  rev(input.matchId, r.tournamentId);
}

export async function voidEvent(formData: FormData) {
  const t = await getT();
  const user = await actionUser("match:void");
  const eventId = String(formData.get("eventId"));
  const matchId = String(formData.get("matchId"));
  const reason = String(formData.get("reason") ?? t("Koreksi operator"));

  const m = await voidManualMatchEvent(matchId, eventId, reason);
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.event.void", entityType: "match", entityId: matchId,
    summary: auditText("Kejadian dibatalkan — {reason}", { reason }),
  });
  rev(matchId, m.tournamentId);
}

/* ── Hasil & statistik ──────────────────────────────────────────────────── */

async function activeWeights() {
  const f = await db.query.scoringFormulas.findFirst({
    where: eq(scoringFormulas.isActive, true),
  });
  return normalizeWeights(f?.weights);
}

async function recomputeTournamentStandings(tournamentId: string) {
  const t = await db.query.tournaments.findFirst({
    where: (tt, { eq: e }) => e(tt.id, tournamentId),
  });
  // a Cup has no table (unless it is an older cup that still has a group stage)
  if (!t || (t.format === "cup" && t.groupCount === 0)) return;

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

/** What happened to a Cup winner after a result was saved — shown to the person who saved it. */
export type CupOutcome = { advancedTo: string | null; warning: string | null };

async function cupOutcome(t: TFunction, matchId: string): Promise<CupOutcome> {
  const r = await advanceCupWinner(matchId);
  if (r.status === "advanced") return { advancedTo: r.to, warning: null };
  if (r.status === "blocked") return { advancedTo: null, warning: r.reason };
  if (r.status === "undecided") {
    return { advancedTo: null, warning: t("Skor seri — isi skor adu penalti agar pemenang maju ke babak berikutnya.") };
  }
  return { advancedTo: null, warning: null };
}

export async function confirmResult(formData: FormData): Promise<CupOutcome> {
  const t = await getT();
  const user = await actionUser("match:confirm");
  const id = String(formData.get("id"));
  const m = await loadMatch(id);
  if (m.status !== "completed") throw new Error(t("Selesaikan pertandingan terlebih dahulu"));
  if (isCupStage(m.stage) && !matchWinnerSide(m)) {
    throw new Error(t("Pertandingan sistem gugur tidak boleh berakhir seri. Isi skor adu penalti terlebih dahulu."));
  }

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
  const outcome = await cupOutcome(t, id);

  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.confirm", entityType: "match", entityId: id,
    summary: outcome.advancedTo
      ? auditText("Hasil {a}-{b} dikonfirmasi; klasemen & statistik diperbarui; pemenang maju ke {slot}", { a: m.homeScore, b: m.awayScore, slot: outcome.advancedTo })
      : auditText("Hasil {a}-{b} dikonfirmasi; klasemen & statistik diperbarui", { a: m.homeScore, b: m.awayScore }),
  });
  rev(id, m.tournamentId);
  return outcome;
}

/** Records the shoot-out score of a Cup match that finished level. */
export async function setShootout(input: { matchId: string; home: number; away: number }): Promise<CupOutcome> {
  const t = await getT();
  const user = await actionUser("match:confirm");
  const { matchId, home, away } = input;
  const m = await loadMatch(matchId);
  if (!isCupStage(m.stage)) throw new Error(t("Adu penalti hanya untuk pertandingan sistem gugur"));
  if (m.status !== "completed") throw new Error(t("Selesaikan pertandingan terlebih dahulu"));
  if (m.homeScore !== m.awayScore) throw new Error(t("Skor tidak seri — adu penalti tidak diperlukan"));
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 30;
  if (!ok(home) || !ok(away)) throw new Error(t("Skor penalti harus bilangan 0–30"));
  if (home === away) throw new Error(t("Adu penalti harus ada pemenangnya — skor tidak boleh sama"));

  await db
    .update(matches)
    .set({ homePenalties: home, awayPenalties: away, updatedAt: new Date() })
    .where(eq(matches.id, matchId));

  // an already confirmed result moves its winner on as soon as the shoot-out is known
  const outcome =
    m.resultStatus === "unconfirmed" ? { advancedTo: null, warning: null } : await cupOutcome(t, matchId);

  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.shootout", entityType: "match", entityId: matchId,
    summary: outcome.advancedTo
      ? auditText("Adu penalti {a}-{b} dicatat; pemenang maju ke {slot}", { a: home, b: away, slot: outcome.advancedTo })
      : auditText("Adu penalti {a}-{b} dicatat", { a: home, b: away }),
  });
  rev(matchId, m.tournamentId);
  return outcome;
}

export async function amendResult(formData: FormData): Promise<CupOutcome> {
  const t = await getT();
  const user = await actionUser("match:amend");
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error(t("Alasan koreksi wajib diisi"));
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
  // a corrected score may change who won: move the (new) winner on
  const outcome = await cupOutcome(t, id);
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "match.amend", entityType: "match", entityId: id,
    summary: outcome.advancedTo
      ? auditText("Hasil dikoreksi menjadi {a}-{b} — {reason}; pemenang maju ke {slot}", { a: after.homeScore, b: after.awayScore, reason, slot: outcome.advancedTo })
      : auditText("Hasil dikoreksi menjadi {a}-{b} — {reason}", { a: after.homeScore, b: after.awayScore, reason }),
  });
  rev(id, m.tournamentId);
  return outcome;
}

