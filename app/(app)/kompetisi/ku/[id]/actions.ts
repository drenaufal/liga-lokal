"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clubs,
  matchEvents,
  matches,
  referees,
  standings,
  tournamentTeams,
  tournaments,
  venues,
} from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { MAX_CUP_TEAMS, cupBracket, groupStage, roundRobin } from "@/lib/fixtures";
import {
  DEFAULT_TIEBREAKERS,
  computeStandings,
  type MatchResultInput,
} from "@/lib/standings";
import { licenseStatus } from "@/lib/status";
import {
  parseSchedule,
  summarizeSchedule,
  type ScheduleContext,
} from "@/lib/schedule-import";
import { checkManualMatch } from "@/lib/match-schedule";
import { activeFormulaWeights, purgeKu } from "@/lib/ku-delete";
import { getTournamentBase, getTournamentImpact } from "@/lib/queries/competition";
import { insertReturning } from "@/lib/db/returning";

const LIFECYCLE = [
  "draft",
  "registration",
  "verification",
  "ready",
  "ongoing",
  "completed",
  "archived",
] as const;
type Status = (typeof LIFECYCLE)[number];

const LABEL: Record<Status, string> = {
  draft: "Draf",
  registration: "Registrasi",
  verification: "Verifikasi",
  ready: "Siap",
  ongoing: "Berlangsung",
  completed: "Selesai",
  archived: "Arsip",
};

/** Everything that shows a KU (its own pages, the Turnamen above it, lists, dashboard). */
function revalidateKu(kuId: string, competitionId?: string) {
  revalidatePath(`/kompetisi/ku/${kuId}`, "layout");
  revalidatePath("/kompetisi");
  if (competitionId) revalidatePath(`/kompetisi/${competitionId}`, "layout");
  revalidatePath("/command-center");
}

async function loadKu(id: string) {
  const t = await getTournamentBase(id);
  if (!t) throw new Error("KU tidak ditemukan");
  return t;
}

export async function setTournamentStatus(formData: FormData) {
  const user = await actionUser("competition:write");
  const id = String(formData.get("id"));
  const target = String(formData.get("status")) as Status;
  if (!LIFECYCLE.includes(target)) throw new Error("Status tidak valid");

  const before = await loadKu(id);

  await db
    .update(tournaments)
    .set({ status: target, updatedAt: new Date() })
    .where(eq(tournaments.id, id));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "tournament.status",
    entityType: "tournament",
    entityId: id,
    summary: `Status "${before.name}" diubah ke ${LABEL[target]}`,
    before: { status: before.status },
    after: { status: target },
  });

  revalidateKu(id, before.competitionId);
}

/* ── Jadwal otomatis ────────────────────────────────────────────────────── */

/** Kick-off slots of a match day, wall-clock WIB. A fifth match of a round goes to the next day. */
const DAY_SLOTS: [number, number][] = [
  [8, 0],
  [10, 0],
  [13, 0],
  [15, 30],
];
const WIB_OFFSET_HOURS = 7;

type Planned = {
  round: number;
  stage: (typeof matches.$inferInsert)["stage"];
  groupLabel: string | null;
  bracketSlot: string | null;
  home: string | null;
  away: string | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
};

export async function generateFixtures(formData: FormData) {
  const user = await actionUser("competition:write");
  const id = String(formData.get("id"));

  const t = await loadKu(id);
  if (t.status === "archived") throw new Error("KU sudah diarsipkan");

  const existing = await db.$count(matches, eq(matches.tournamentId, id));
  if (existing > 0) throw new Error("Jadwal sudah dibuat. Hapus dahulu untuk membuat ulang.");

  const teams = await db
    .select({ clubId: tournamentTeams.clubId })
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, id))
    .orderBy(tournamentTeams.seed);
  if (teams.length < 2) throw new Error("Minimal 2 SSB peserta diperlukan.");
  const ids = teams.map((x) => x.clubId);

  let planned: Planned[];
  if (t.format === "league") {
    planned = roundRobin(ids, { stage: "league", doubleRound: t.doubleRound }).map((fx) => ({
      round: fx.round,
      stage: "league",
      groupLabel: null,
      bracketSlot: null,
      home: fx.home,
      away: fx.away,
      homePlaceholder: null,
      awayPlaceholder: null,
    }));
  } else if (t.groupCount > 0) {
    // an older cup that still has a group stage
    planned = groupStage(ids, Math.max(2, t.groupCount), t.doubleRound).map((fx) => ({
      round: fx.round,
      stage: "group",
      groupLabel: fx.groupLabel ?? null,
      bracketSlot: null,
      home: fx.home,
      away: fx.away,
      homePlaceholder: null,
      awayPlaceholder: null,
    }));
  } else {
    if (ids.length > MAX_CUP_TEAMS) throw new Error(`Maksimal ${MAX_CUP_TEAMS} SSB untuk format Cup.`);
    planned = cupBracket(ids).map((fx) => ({
      round: fx.round,
      stage: fx.stage,
      groupLabel: null,
      bracketSlot: fx.bracketSlot,
      home: fx.home,
      away: fx.away,
      homePlaceholder: fx.homePlaceholder ?? null,
      awayPlaceholder: fx.awayPlaceholder ?? null,
    }));
  }

  // One round per week from the start date, up to four kick-offs per day.
  const start = t.startDate
    ? (() => {
        const [y, m, d] = t.startDate.split("-").map(Number);
        return { y, m: m - 1, d };
      })()
    : (() => {
        const now = new Date(Date.now() + WIB_OFFSET_HOURS * 3_600_000);
        return { y: now.getUTCFullYear(), m: now.getUTCMonth(), d: now.getUTCDate() + 1 };
      })();
  const perRound = new Map<number, number>();
  const rows = planned.map((fx) => {
    const k = perRound.get(fx.round) ?? 0;
    perRound.set(fx.round, k + 1);
    const [hh, mm] = DAY_SLOTS[k % DAY_SLOTS.length];
    const dayOffset = (fx.round - 1) * 7 + Math.floor(k / DAY_SLOTS.length);
    return {
      tournamentId: id,
      stage: fx.stage,
      round: fx.round,
      groupLabel: fx.groupLabel,
      bracketSlot: fx.bracketSlot,
      homeClubId: fx.home,
      awayClubId: fx.away,
      homePlaceholder: fx.homePlaceholder,
      awayPlaceholder: fx.awayPlaceholder,
      scheduledAt: new Date(Date.UTC(start.y, start.m, start.d + dayOffset, hh - WIB_OFFSET_HOURS, mm)),
      status: "scheduled" as const,
      homeFormation: "4-3-3",
      awayFormation: "4-3-3",
    };
  });

  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(matches).values(rows.slice(i, i + 200));
  }

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "fixture.generate",
    entityType: "tournament",
    entityId: id,
    summary: `${rows.length} pertandingan dijadwalkan otomatis untuk "${t.name}"`,
  });

  revalidateKu(id, t.competitionId);
  revalidatePath("/match-ops");
}

/* ── Konteks jadwal: peserta, venue, wasit, jadwal yang sudah ada ───────── */

/**
 * Everything needed to check a schedule (uploaded or typed) against this KU.
 * With `replaceScheduled`, fixtures that have not started are about to be
 * removed, so they must not count as duplicates.
 */
async function scheduleContext(kuId: string, replaceScheduled: boolean) {
  const t = await loadKu(kuId);

  const [teams, venueRows, refereeRows, existing] = await Promise.all([
    db
      .select({ clubId: clubs.id, short: clubs.shortName, name: clubs.name })
      .from(tournamentTeams)
      .innerJoin(clubs, eq(clubs.id, tournamentTeams.clubId))
      .where(eq(tournamentTeams.tournamentId, kuId)),
    db.select({ id: venues.id, name: venues.name }).from(venues),
    db.select().from(referees),
    db
      .select({
        homeClubId: matches.homeClubId,
        awayClubId: matches.awayClubId,
        stage: matches.stage,
        round: matches.round,
        scheduledAt: matches.scheduledAt,
        status: matches.status,
      })
      .from(matches)
      .where(eq(matches.tournamentId, kuId)),
  ]);

  const scheduledCount = existing.filter((m) => m.status === "scheduled").length;
  const refereeList = refereeRows.map((r) => {
    const st = licenseStatus(r.licenseExpiry, r.status === "revoked");
    return { id: r.id, license: r.licenseNumber, name: r.fullName, valid: st === "active" || st === "expiring" };
  });
  const ctx: ScheduleContext = {
    format: t.format,
    teams,
    venues: venueRows,
    referees: refereeList,
    existing: replaceScheduled ? existing.filter((m) => m.status !== "scheduled") : existing,
  };
  return { t, ctx, scheduledCount, venueRows, refereeList, existing };
}

/* ── Unggah jadwal (CSV) ────────────────────────────────────────────────── */

/** Reads and checks an uploaded schedule without saving anything. */
export async function previewSchedule(tournamentId: string, csv: string, replaceScheduled = false) {
  await actionUser("competition:write");
  const { t, ctx, scheduledCount } = await scheduleContext(tournamentId, replaceScheduled);
  const parsed = parseSchedule(csv, ctx);
  return {
    error: parsed.error ?? null,
    rows: parsed.rows,
    summary: summarizeSchedule(parsed.rows),
    scheduledCount,
    archived: t.status === "archived",
  };
}

/** Saves every valid row of an uploaded schedule as a scheduled match. */
export async function importSchedule(tournamentId: string, csv: string, replaceScheduled = false) {
  const user = await actionUser("competition:write");
  const { t, ctx, scheduledCount } = await scheduleContext(tournamentId, replaceScheduled);
  if (t.status === "archived") throw new Error("KU sudah diarsipkan");

  // checked again here — the browser's copy of the preview is never trusted
  const parsed = parseSchedule(csv, ctx);
  if (parsed.error) throw new Error(parsed.error);
  const rows = parsed.rows.filter((r) => r.status === "ok" || r.status === "warning");
  if (rows.length === 0) throw new Error("Tidak ada baris yang bisa diimpor");

  let removed = 0;
  await db.transaction(async (tx) => {
    if (replaceScheduled && scheduledCount > 0) {
      await tx
        .delete(matches)
        .where(and(eq(matches.tournamentId, tournamentId), eq(matches.status, "scheduled")));
      removed = scheduledCount;
    }
    for (let i = 0; i < rows.length; i += 200) {
      await tx.insert(matches).values(
        rows.slice(i, i + 200).map((r) => ({
          tournamentId,
          stage: r.stage as (typeof matches.$inferInsert)["stage"],
          round: r.round ?? 1,
          groupLabel: r.group ?? null,
          bracketSlot: r.bracketSlot ?? null,
          homeClubId: r.homeClubId!,
          awayClubId: r.awayClubId!,
          venueId: r.venueId ?? null,
          refereeId: r.refereeId ?? null,
          scheduledAt: new Date(r.scheduledAt!),
          status: "scheduled" as const,
          homeFormation: "4-3-3",
          awayFormation: "4-3-3",
        })),
      );
    }
  });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "fixture.import",
    entityType: "tournament",
    entityId: tournamentId,
    summary: `Jadwal diunggah ke "${t.name}": ${rows.length} pertandingan${removed ? `, ${removed} jadwal lama diganti` : ""}${parsed.rows.length > rows.length ? `, ${parsed.rows.length - rows.length} baris dilewati` : ""}`,
  });

  revalidateKu(tournamentId, t.competitionId);
  revalidatePath("/match-ops");
  return { imported: rows.length, skipped: parsed.rows.length - rows.length, removed };
}

/* ── Jadwal manual ──────────────────────────────────────────────────────── */

const matchInput = z.object({
  homeClubId: z.string().max(36),
  awayClubId: z.string().max(36),
  date: z.string().max(16),
  time: z.string().max(8),
  stage: z.string().max(16),
  round: z.coerce.number().int(),
  venueId: z.string().max(36).nullish(),
  refereeId: z.string().max(36).nullish(),
  bracketSlot: z.string().max(16).nullish(),
});

export type CreateMatchResult =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

/** Adds one match to a KU's schedule by hand. */
export async function createMatch(kuId: string, input: unknown): Promise<CreateMatchResult> {
  const user = await actionUser("competition:write");
  const parsed = matchInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Isian tidak lengkap.", fieldErrors: {} };

  const { t, ctx, venueRows, refereeList } = await scheduleContext(kuId, false);
  if (t.status === "archived") {
    return { ok: false, error: "KU sudah diarsipkan — jadwalnya tidak dapat diubah.", fieldErrors: {} };
  }

  const v = parsed.data;
  const check = checkManualMatch(
    { ...v, venueId: v.venueId || null, refereeId: v.refereeId || null, bracketSlot: v.bracketSlot || null },
    {
      format: t.format,
      hasGroups: t.groupCount > 0,
      teamIds: ctx.teams.map((x) => x.clubId),
      venueIds: venueRows.map((x) => x.id),
      referees: refereeList.map((r) => ({ id: r.id, valid: r.valid })),
      existing: ctx.existing,
    },
  );
  if (Object.keys(check.errors).length || !check.scheduledAt) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: check.errors };
  }

  const [created] = await insertReturning(db, matches, {
    tournamentId: kuId,
    stage: v.stage as (typeof matches.$inferInsert)["stage"],
    round: v.round,
    bracketSlot: v.bracketSlot?.trim().toUpperCase() || null,
    homeClubId: v.homeClubId,
    awayClubId: v.awayClubId,
    venueId: v.venueId || null,
    refereeId: v.refereeId || null,
    scheduledAt: check.scheduledAt,
    status: "scheduled",
    homeFormation: "4-3-3",
    awayFormation: "4-3-3",
  });

  const home = ctx.teams.find((x) => x.clubId === v.homeClubId)?.short ?? "?";
  const away = ctx.teams.find((x) => x.clubId === v.awayClubId)?.short ?? "?";
  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "fixture.create",
    entityType: "match",
    entityId: created.id,
    summary: `Pertandingan ditambahkan manual ke "${t.name}": ${home} vs ${away}`,
  });

  revalidateKu(kuId, t.competitionId);
  revalidatePath("/match-ops");
  return { ok: true, warnings: check.warnings };
}

/** Removes a match that has not started — for a typo, a changed draw or a cancelled fixture. */
export async function deleteMatch(matchId: string) {
  const user = await actionUser("competition:write");
  const m = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!m) throw new Error("Pertandingan tidak ditemukan");
  if (m.status !== "scheduled") {
    throw new Error("Hanya pertandingan berstatus Terjadwal yang dapat dihapus.");
  }
  const t = await loadKu(m.tournamentId);
  if (t.status === "archived") throw new Error("KU sudah diarsipkan — jadwalnya tidak dapat diubah.");

  await db.delete(matches).where(eq(matches.id, matchId));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "fixture.delete",
    entityType: "match",
    entityId: matchId,
    summary: `Pertandingan terjadwal dihapus dari "${t.name}"`,
  });

  revalidateKu(m.tournamentId, t.competitionId);
  revalidatePath("/match-ops");
}

/* ── Peserta ────────────────────────────────────────────────────────────── */

/** Participants can change until the KU is finished. */
function assertOpen(status: string) {
  if (status === "completed" || status === "archived") {
    throw new Error("KU sudah selesai — peserta tidak dapat diubah.");
  }
}

export async function addTeam(kuId: string, clubId: string) {
  const user = await actionUser("competition:write");
  const t = await loadKu(kuId);
  assertOpen(t.status);

  const club = await db.query.clubs.findFirst({ where: eq(clubs.id, clubId) });
  if (!club || !club.active) throw new Error("SSB tidak ditemukan");
  const current = await db
    .select({ clubId: tournamentTeams.clubId, seed: tournamentTeams.seed })
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, kuId));
  if (current.some((c) => c.clubId === clubId)) throw new Error("SSB ini sudah menjadi peserta");
  if (t.format === "cup" && current.length >= MAX_CUP_TEAMS) {
    throw new Error(`Maksimal ${MAX_CUP_TEAMS} SSB untuk format Cup.`);
  }

  await db.insert(tournamentTeams).values({
    tournamentId: kuId,
    clubId,
    seed: Math.max(0, ...current.map((c) => c.seed ?? 0)) + 1,
    registrationStatus: "registered",
  });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "tournament.team.add",
    entityType: "tournament",
    entityId: kuId,
    summary: `${club.name} ditambahkan sebagai peserta "${t.name}"`,
  });
  revalidateKu(kuId, t.competitionId);
}

export async function removeTeam(kuId: string, clubId: string) {
  const user = await actionUser("competition:write");
  const t = await loadKu(kuId);
  assertOpen(t.status);

  const played = await db.$count(
    matches,
    and(eq(matches.tournamentId, kuId), or(eq(matches.homeClubId, clubId), eq(matches.awayClubId, clubId))),
  );
  if (played > 0) {
    throw new Error(`SSB ini punya ${played} pertandingan di KU ini. Hapus jadwalnya dahulu sebelum mengeluarkannya.`);
  }

  const club = await db.query.clubs.findFirst({ where: eq(clubs.id, clubId) });
  await db
    .delete(tournamentTeams)
    .where(and(eq(tournamentTeams.tournamentId, kuId), eq(tournamentTeams.clubId, clubId)));
  await db.delete(standings).where(and(eq(standings.tournamentId, kuId), eq(standings.clubId, clubId)));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "tournament.team.remove",
    entityType: "tournament",
    entityId: kuId,
    summary: `${club?.name ?? "SSB"} dikeluarkan dari peserta "${t.name}"`,
  });
  revalidateKu(kuId, t.competitionId);
}

/* ── Hapus KU ───────────────────────────────────────────────────────────── */

/**
 * Deletes a KU with everything inside it (see purgeKu): its numbers are taken
 * back out of each player's career totals, awards and reports go, and teams,
 * squads, standings, matches and events follow through the foreign keys.
 * Needs the KU code (or, for a KU without an age category, the Turnamen name)
 * to be typed, and is refused while a match is in play.
 */
export async function deleteTournament(formData: FormData) {
  const user = await actionUser("competition:delete");
  const id = String(formData.get("id"));
  const typed = String(formData.get("confirm") ?? "").trim();

  const t = await loadKu(id);
  const expected = t.ageCategory?.code ?? t.competition.name;
  if (typed !== expected) throw new Error("Teks konfirmasi yang diketik tidak cocok");

  const impact = await getTournamentImpact(id);
  if (impact.live > 0)
    throw new Error(`Ada ${impact.live} pertandingan yang sedang berlangsung. Akhiri dahulu sebelum menghapus KU.`);

  const weights = await activeFormulaWeights();
  await db.transaction((tx) => purgeKu(tx, id, weights));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "tournament.delete",
    entityType: "tournament",
    entityId: id,
    summary: `KU "${t.name}" dihapus (${impact.teams} SSB, ${impact.matches} pertandingan, ${impact.events} kejadian; statistik ${impact.players} pemain dikoreksi)`,
    before: { name: t.name, status: t.status, ...impact },
  });

  revalidatePath("/", "layout");
  redirect(`/kompetisi/${t.competitionId}`);
}

/* ── Klasemen ───────────────────────────────────────────────────────────── */

export async function recomputeStandings(formData: FormData) {
  const user = await actionUser("competition:write");
  const id = String(formData.get("id"));
  const t = await loadKu(id);

  const teams = await db
    .select({ clubId: tournamentTeams.clubId, group: tournamentTeams.groupLabel })
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, id));
  const groupsByClub = Object.fromEntries(
    teams.map((x) => [x.clubId, x.group ?? "-"]),
  );

  const done = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, id), eq(matches.status, "completed")));

  const matchIds = done.map((m) => m.id);
  const events = matchIds.length
    ? await db
        .select()
        .from(matchEvents)
        .where(inArray(matchEvents.matchId, matchIds))
    : [];

  const results: MatchResultInput[] = done
    .filter((m) => m.homeClubId && m.awayClubId)
    .map((m) => ({
      homeClubId: m.homeClubId!,
      awayClubId: m.awayClubId!,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      groupLabel: m.groupLabel,
      homeYellow: events.filter(
        (e) => e.matchId === m.id && e.type === "yellow_card" && e.clubId === m.homeClubId,
      ).length,
      awayYellow: events.filter(
        (e) => e.matchId === m.id && e.type === "yellow_card" && e.clubId === m.awayClubId,
      ).length,
      homeRed: events.filter(
        (e) => e.matchId === m.id && e.type === "red_card" && e.clubId === m.homeClubId,
      ).length,
      awayRed: events.filter(
        (e) => e.matchId === m.id && e.type === "red_card" && e.clubId === m.awayClubId,
      ).length,
    }));

  const rows = computeStandings(
    teams.map((x) => x.clubId),
    results,
    { pointsWin: t.pointsWin, pointsDraw: t.pointsDraw, pointsLoss: t.pointsLoss, tiebreakers: t.tiebreakers ?? DEFAULT_TIEBREAKERS },
    groupsByClub,
  );

  await db.delete(standings).where(eq(standings.tournamentId, id));
  if (rows.length) {
    await db.insert(standings).values(
      rows.map((r) => ({
        tournamentId: id,
        clubId: r.clubId,
        groupLabel: r.groupLabel,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        goalsFor: r.goalsFor,
        goalsAgainst: r.goalsAgainst,
        points: r.points,
        fairPlayPoints: r.fairPlayPoints,
        form: r.form,
        rank: r.rank,
      })),
    );
  }

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "standings.recompute",
    entityType: "tournament",
    entityId: id,
    summary: `Klasemen "${t.name}" dihitung ulang dari ${results.length} hasil pertandingan`,
  });

  revalidateKu(id, t.competitionId);
}
