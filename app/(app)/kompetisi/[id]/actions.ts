"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiReports,
  clubs,
  matchEvents,
  matches,
  playerBadges,
  playerStats,
  referees,
  scoringFormulas,
  standings,
  tournamentTeams,
  tournaments,
  venues,
} from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { groupStage, roundRobin } from "@/lib/fixtures";
import {
  DEFAULT_TIEBREAKERS,
  computeStandings,
  type MatchResultInput,
} from "@/lib/standings";
import { COUNTER_FIELDS } from "@/lib/player-stats";
import { DEFAULT_WEIGHTS, computeRating, computeScore } from "@/lib/scoring";
import { licenseStatus } from "@/lib/status";
import {
  parseSchedule,
  summarizeSchedule,
  type ScheduleContext,
} from "@/lib/schedule-import";
import { getTournamentImpact } from "@/lib/queries/competition";

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

export async function setTournamentStatus(formData: FormData) {
  const user = await actionUser("competition:write");
  const id = String(formData.get("id"));
  const target = String(formData.get("status")) as Status;
  if (!LIFECYCLE.includes(target)) throw new Error("Status tidak valid");

  const before = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, id),
  });

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
    summary: `Status "${before?.name}" diubah ke ${LABEL[target]}`,
    before: { status: before?.status },
    after: { status: target },
  });

  revalidatePath(`/kompetisi/${id}`, "layout");
  revalidatePath("/kompetisi");
  revalidatePath("/command-center");
}

export async function generateFixtures(formData: FormData) {
  const user = await actionUser("competition:write");
  const id = String(formData.get("id"));

  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) });
  if (!t) throw new Error("Turnamen tidak ditemukan");

  const existing = await db.$count(matches, eq(matches.tournamentId, id));
  if (existing > 0) throw new Error("Jadwal sudah dibuat. Hapus dahulu untuk membuat ulang.");

  const teams = await db
    .select({ clubId: tournamentTeams.clubId, group: tournamentTeams.groupLabel })
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, id));
  if (teams.length < 2) throw new Error("Minimal 2 tim peserta diperlukan.");

  const ids = teams.map((x) => x.clubId);
  let fixtures;
  if (t.format === "league") {
    fixtures = roundRobin(ids, { stage: "league", doubleRound: t.doubleRound });
  } else if (t.format === "cup") {
    fixtures = groupStage(ids, Math.max(2, t.groupCount || 2), t.doubleRound);
  } else {
    // knockout / hybrid — simple seeded pairing
    fixtures = ids.slice(0, Math.floor(ids.length / 2) * 2).reduce<
      { round: number; stage: "knockout"; home: string; away: string; bracketSlot: string }[]
    >((acc, _, i, arr) => {
      if (i % 2 === 0)
        acc.push({
          round: 1,
          stage: "knockout",
          home: arr[i],
          away: arr[i + 1],
          bracketSlot: `QF${i / 2 + 1}`,
        });
      return acc;
    }, []);
  }

  const base = t.startDate ? new Date(t.startDate) : new Date();
  const rows = fixtures.map((fx, i) => {
    const d = new Date(base.getTime() + Math.floor(i / 2) * 3 * 86400000);
    d.setUTCHours(8, 30, 0, 0); // 15:30 WIB, independent of the server's time zone
    return {
      tournamentId: id,
      stage:
        "stage" in fx && fx.stage === "group"
          ? ("group" as const)
          : "stage" in fx && fx.stage === "knockout"
            ? ("quarter" as const)
            : ("league" as const),
      round: fx.round,
      groupLabel: "groupLabel" in fx ? (fx.groupLabel ?? null) : null,
      bracketSlot: "bracketSlot" in fx ? (fx.bracketSlot ?? null) : null,
      homeClubId: fx.home,
      awayClubId: fx.away,
      scheduledAt: d,
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

  revalidatePath(`/kompetisi/${id}`, "layout");
}

/* ── Unggah jadwal (CSV) ────────────────────────────────────────────────── */

/**
 * Everything needed to check an uploaded schedule against this tournament.
 * With `replaceScheduled`, fixtures that have not started are about to be
 * removed, so they must not count as duplicates.
 */
async function scheduleContext(tournamentId: string, replaceScheduled: boolean) {
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
  if (!t) throw new Error("Turnamen tidak ditemukan");

  const [teams, venueRows, refereeRows, existing] = await Promise.all([
    db
      .select({ clubId: clubs.id, short: clubs.shortName, name: clubs.name })
      .from(tournamentTeams)
      .innerJoin(clubs, eq(clubs.id, tournamentTeams.clubId))
      .where(eq(tournamentTeams.tournamentId, tournamentId)),
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
      .where(eq(matches.tournamentId, tournamentId)),
  ]);

  const scheduledCount = existing.filter((m) => m.status === "scheduled").length;
  const ctx: ScheduleContext = {
    format: t.format,
    teams,
    venues: venueRows,
    referees: refereeRows.map((r) => {
      const st = licenseStatus(r.licenseExpiry, r.status === "revoked");
      return { id: r.id, license: r.licenseNumber, name: r.fullName, valid: st === "active" || st === "expiring" };
    }),
    existing: replaceScheduled ? existing.filter((m) => m.status !== "scheduled") : existing,
  };
  return { t, ctx, scheduledCount };
}

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
  if (t.status === "archived") throw new Error("Turnamen sudah diarsipkan");

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

  revalidatePath(`/kompetisi/${tournamentId}`, "layout");
  revalidatePath("/match-ops");
  revalidatePath("/command-center");
  return { imported: rows.length, skipped: parsed.rows.length - rows.length, removed };
}

/* ── Hapus turnamen ─────────────────────────────────────────────────────── */

/**
 * Deletes a tournament with everything inside it. Before it goes, its numbers
 * are taken back out of each player's career totals; its awards and generated
 * reports are removed; teams, squads, standings, matches, events, line-ups and
 * per-tournament stats follow through the foreign keys.
 */
export async function deleteTournament(formData: FormData) {
  const user = await actionUser("competition:delete");
  const id = String(formData.get("id"));
  const typed = String(formData.get("confirm") ?? "").trim();

  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) });
  if (!t) throw new Error("Turnamen tidak ditemukan");
  if (typed !== t.name) throw new Error("Nama turnamen yang diketik tidak cocok");

  const impact = await getTournamentImpact(id);
  if (impact.live > 0)
    throw new Error(`Ada ${impact.live} pertandingan yang sedang berlangsung. Akhiri dahulu sebelum menghapus turnamen.`);

  const formula = await db.query.scoringFormulas.findFirst({ where: eq(scoringFormulas.isActive, true) });
  const weights = formula?.weights ?? DEFAULT_WEIGHTS;

  await db.transaction(async (tx) => {
    // 1. the tournament's contribution comes out of every career line
    const rows = await tx.select().from(playerStats).where(eq(playerStats.tournamentId, id));
    for (const r of rows) {
      const [career] = await tx
        .select()
        .from(playerStats)
        .where(
          and(
            eq(playerStats.playerId, r.playerId),
            eq(playerStats.season, "career"),
            isNull(playerStats.tournamentId),
          ),
        )
        .limit(1)
        .for("update");
      if (!career) continue;
      const next = {} as Record<(typeof COUNTER_FIELDS)[number], number>;
      for (const f of COUNTER_FIELDS) next[f] = Math.max(0, career[f] - r[f]);
      await tx
        .update(playerStats)
        .set({
          ...next,
          score: computeScore(next, weights),
          rating: computeRating(next, next.appearances || 1, weights),
          updatedAt: new Date(),
        })
        .where(eq(playerStats.id, career.id));
    }

    // 2. awards and generated reports that belong to it
    await tx.delete(playerBadges).where(eq(playerBadges.tournamentId, id));
    const matchIds = (await tx.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, id))).map(
      (m) => m.id,
    );
    await tx
      .delete(aiReports)
      .where(
        or(
          and(eq(aiReports.subjectType, "tournament"), eq(aiReports.subjectId, id)),
          matchIds.length
            ? and(eq(aiReports.subjectType, "match"), inArray(aiReports.subjectId, matchIds))
            : undefined,
        ),
      );

    // 3. the tournament itself; everything under it cascades
    await tx.delete(tournaments).where(eq(tournaments.id, id));
  });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "tournament.delete",
    entityType: "tournament",
    entityId: id,
    summary: `Turnamen "${t.name}" dihapus (${impact.teams} tim, ${impact.matches} pertandingan, ${impact.events} kejadian; statistik ${impact.players} pemain dikoreksi)`,
    before: { name: t.name, status: t.status, ...impact },
  });

  revalidatePath("/", "layout");
  redirect("/kompetisi");
}

export async function recomputeStandings(formData: FormData) {
  const user = await actionUser("competition:write");
  const id = String(formData.get("id"));
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) });
  if (!t) throw new Error("Turnamen tidak ditemukan");

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

  revalidatePath(`/kompetisi/${id}`, "layout");
}
