import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { hashPassword } from "@/lib/auth/password";
import { assertDemoSeedAllowed } from "./seed-guard";
import { z } from "zod";
import type { db } from "@/lib/db";
import { ageCategories, auditLogs, clubs, coaches, competitions, matchDspSubmissions, matchLineups, matches, tournaments, users } from "./schema";
import { getEligibleMatchPlayers } from "@/lib/queries/match-roster";
import { checkDspSelections } from "@/lib/dsp";
import { positionLine } from "@/lib/positions";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";

type Database = typeof db;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Coach = typeof coaches.$inferSelect;
type Eligible = Awaited<ReturnType<typeof getEligibleMatchPlayers>>[number];
const SEED_ACTION = "seed.dsp";

/** One goalkeeper and a balanced starting team; remaining players form the bench. */
function selectionsFor(players: Eligible[], rules: { playersOnField: number; maxSquad: number } | null) {
  const fieldSize = rules?.playersOnField ?? 11;
  const maxSquad = rules?.maxSquad ?? 20;
  const keeper = players.find((p) => p.position === "GK");
  const field = players.filter((p) => p.position !== "GK");
  if (!keeper || field.length < fieldSize - 1) throw new Error("Pemain atau kiper belum cukup untuk starter sesuai KU.");
  const starters = [keeper];
  const fieldCount = fieldSize - 1;
  const quotas = { DF: Math.floor(fieldCount * 0.4), MF: Math.floor(fieldCount * 0.4), FW: fieldCount - 2 * Math.floor(fieldCount * 0.4) };
  for (const line of ["DF", "MF", "FW"] as const) starters.push(...field.filter((p) => positionLine(p.position) === line).slice(0, quotas[line]));
  for (const p of field) if (starters.length < fieldSize && !starters.some((s) => s.id === p.id)) starters.push(p);
  const bench = players.filter((p) => !starters.some((s) => s.id === p.id)).slice(0, Math.min(4, Math.max(0, maxSquad - fieldSize)));
  const selected = [...starters.map((p) => ({ playerId: p.id, role: "starter" as const })), ...bench.map((p) => ({ playerId: p.id, role: "substitute" as const }))];
  checkDspSelections(selected, players.map((p) => p.id), rules);
  return selected;
}

function teamSelections(eligible: Eligible[], clubIds: string[], rules: { playersOnField: number; maxSquad: number } | null) {
  const teams = clubIds.map((clubId) => selectionsFor(eligible.filter((p) => p.clubId === clubId), rules));
  const ids = teams.flatMap((t) => t.map((p) => p.playerId));
  if (new Set(ids).size !== ids.length) throw new Error("Pemain terdaftar di kedua tim; seed pertandingan ini dilewati.");
  return teams;
}

async function ensureCoachAccount(executor: Database, coachId: string) {
  return executor.transaction(async (tx) => {
    const [coach] = await tx.select().from(coaches).where(eq(coaches.id, coachId)).for("update");
    if (!coach?.clubId) throw new Error("Pelatih belum terhubung dengan klub.");
    const email = z.email().safeParse(coach.email?.trim().toLowerCase());
    const loginEmail = email.success ? email.data : `coach-${coach.id}@demo.ligalokal.invalid`;
    const [existing] = await tx.select({ id: users.id, email: users.email, role: users.role, clubId: users.clubId, active: users.active }).from(users)
      .where(coach.userId ? eq(users.id, coach.userId) : eq(users.email, loginEmail)).for("update");
    if (existing && (existing.role !== "coach" || !existing.active || (existing.clubId && existing.clubId !== coach.clubId)))
      throw new Error("Akun pelatih sudah memiliki penugasan lain atau tidak aktif.");
    if (coach.userId && !existing) throw new Error("Akun pelatih yang terhubung tidak ditemukan.");
    let userId = existing?.id;
    let created = false;
    if (!userId) {
      userId = crypto.randomUUID();
      await tx.insert(users).values({ id: userId, name: coach.fullName, email: loginEmail, role: "coach", clubId: coach.clubId, title: coach.specialty,
        passwordHash: await hashPassword(DEMO_PASSWORD), active: true });
      created = true;
    } else if (!existing!.clubId) {
      await tx.update(users).set({ clubId: coach.clubId }).where(eq(users.id, userId));
    }
    if (!coach.userId) {
      const [linked] = await tx.select({ id: coaches.id }).from(coaches).where(eq(coaches.userId, userId));
      if (linked && linked.id !== coach.id) throw new Error("Akun sudah terhubung dengan profil pelatih lain.");
      await tx.update(coaches).set({ userId }).where(eq(coaches.id, coach.id));
      await tx.insert(auditLogs).values({ actorName: "Seed DSP", actorRole: "system", action: "seed.coach", entityType: "coach", entityId: coach.id,
        summary: `Akun contoh pelatih dihubungkan: ${coach.fullName}`, after: { userId, clubId: coach.clubId, accountCreated: created } });
    }
    return { coachId: coach.id, userId, name: coach.fullName, email: existing?.email ?? loginEmail, clubId: coach.clubId, created };
  });
}

async function connectDemoCoach(executor: Database) {
  return executor.transaction(async (tx) => {
    const [club] = await tx.select({ id: clubs.id, name: clubs.name }).from(clubs).where(eq(clubs.shortName, "GMF"));
    if (!club) return false;
    const [account] = await tx.select({ id: users.id, clubId: users.clubId, role: users.role, active: users.active }).from(users)
      .where(eq(users.email, "pelatih@ligalokal.id")).for("update");
    if (!account || account.role !== "coach" || !account.active || account.clubId) return false;
    await tx.update(users).set({ clubId: club.id }).where(and(eq(users.id, account.id), isNull(users.clubId)));
    await tx.insert(auditLogs).values({ actorName: "Seed DSP", actorRole: "system", action: "seed.coach", entityType: "user", entityId: account.id,
      summary: `Akun pelatih ditugaskan ke ${club.name}`, after: { clubId: club.id } });
    return true;
  });
}

export type SeedDspOptions = { maxMatches?: number; perKu?: number; dryRun?: boolean };

/** Additive and repeatable: never replaces a lineup/submission or touches a started match. */
export async function seedCoachDsp(executor: Database, options: SeedDspOptions = {}) {
  // New coach logins get the shared demo password, so a dry run is the only thing allowed in production.
  if (!options.dryRun) assertDemoSeedAllowed();
  const maxMatches = z.number().int().min(1).max(24).parse(options.maxMatches ?? 6);
  const perKu = z.number().int().min(1).max(12).parse(options.perKu ?? 2);
  const H = alias(clubs, "seed_dsp_home"), A = alias(clubs, "seed_dsp_away");
  const [fixtures, coachRows, seededRows] = await Promise.all([
    executor.select({ match: matches, homeName: H.name, awayName: A.name, homeShort: H.shortName, awayShort: A.shortName, competition: competitions.name, age: ageCategories.code, rules: ageCategories.rules })
      .from(matches).innerJoin(tournaments, eq(tournaments.id, matches.tournamentId)).innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
      .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId)).leftJoin(H, eq(H.id, matches.homeClubId)).leftJoin(A, eq(A.id, matches.awayClubId))
      .where(and(eq(matches.status, "scheduled"), eq(matches.period, "not_started"), isNotNull(matches.homeClubId), isNotNull(matches.awayClubId)))
      .orderBy(asc(matches.scheduledAt), asc(matches.id)),
    executor.select().from(coaches).where(isNotNull(coaches.clubId)).orderBy(asc(coaches.fullName), asc(coaches.id)),
    executor.selectDistinct({ id: matches.id, kuId: matches.tournamentId }).from(auditLogs).innerJoin(matches, eq(matches.id, auditLogs.entityId)).where(eq(auditLogs.action, SEED_ACTION)),
  ]);
  const headByClub = new Map<string, Coach>();
  for (const c of [...coachRows].sort((a, b) => Number(b.specialty === "Pelatih Kepala") - Number(a.specialty === "Pelatih Kepala")))
    if (c.clubId && !headByClub.has(c.clubId)) headByClub.set(c.clubId, c);
  const fixtureIds = fixtures.map((f) => f.match.id);
  const occupied = new Set<string>();
  if (fixtureIds.length) {
    const [lineups, submitted] = await Promise.all([
      executor.selectDistinct({ matchId: matchLineups.matchId }).from(matchLineups).where(inArray(matchLineups.matchId, fixtureIds)),
      executor.selectDistinct({ matchId: matchDspSubmissions.matchId }).from(matchDspSubmissions).where(inArray(matchDspSubmissions.matchId, fixtureIds)),
    ]);
    for (const r of [...lineups, ...submitted]) occupied.add(r.matchId);
  }
  const perKuCount = new Map<string, number>();
  for (const s of seededRows) perKuCount.set(s.kuId, (perKuCount.get(s.kuId) ?? 0) + 1);
  // Include Garuda Muda so the existing demo coach can inspect a populated DSP.
  fixtures.sort((a, b) => Number(b.homeShort === "GMF" || b.awayShort === "GMF") - Number(a.homeShort === "GMF" || a.awayShort === "GMF"));
  const planned: { fixture: (typeof fixtures)[number]; coaches: Coach[]; selections: ReturnType<typeof selectionsFor>[] }[] = [];
  const skipped: { matchId: string; reason: string }[] = [];
  for (const f of fixtures) {
    if (planned.length + seededRows.length >= maxMatches) break;
    if ((perKuCount.get(f.match.tournamentId) ?? 0) >= perKu) continue;
    if (occupied.has(f.match.id)) { skipped.push({ matchId: f.match.id, reason: "Sudah ada susunan pemain atau DSP" }); continue; }
    const sideClubs = [f.match.homeClubId!, f.match.awayClubId!];
    const sideCoaches = sideClubs.map((c) => headByClub.get(c));
    if (sideCoaches.some((c) => !c)) { skipped.push({ matchId: f.match.id, reason: "Pelatih klub belum tersedia" }); continue; }
    try {
      const eligible = await getEligibleMatchPlayers(f.match.tournamentId, sideClubs, executor);
      const selections = teamSelections(eligible, sideClubs, f.rules);
      planned.push({ fixture: f, coaches: sideCoaches as Coach[], selections });
      perKuCount.set(f.match.tournamentId, (perKuCount.get(f.match.tournamentId) ?? 0) + 1);
    } catch (e) { skipped.push({ matchId: f.match.id, reason: e instanceof Error ? e.message : "Skuad tidak valid" }); }
  }
  const accounts = new Map<string, Awaited<ReturnType<typeof ensureCoachAccount>>>();
  const results: { matchId: string; kuId: string; competition: string; age: string | null; home: string | null; away: string | null; teams: { coach: string; email: string; starters: number; substitutes: number }[] }[] = [];
  const demoCoachConnected = options.dryRun ? false : await connectDemoCoach(executor);
  for (const plan of planned) {
    if (options.dryRun) {
      results.push({ matchId: plan.fixture.match.id, kuId: plan.fixture.match.tournamentId, competition: plan.fixture.competition, age: plan.fixture.age,
        home: plan.fixture.homeName, away: plan.fixture.awayName, teams: plan.coaches.map((c, i) => ({ coach: c.fullName, email: c.email ?? "", starters: plan.selections[i].filter((p) => p.role === "starter").length, substitutes: plan.selections[i].filter((p) => p.role === "substitute").length })) });
      continue;
    }
    for (const c of plan.coaches) if (!accounts.has(c.id)) accounts.set(c.id, await ensureCoachAccount(executor, c.id));
    const result = await executor.transaction(async (tx: Tx) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, plan.fixture.match.id)).for("update");
      if (!m || m.status !== "scheduled" || m.period !== "not_started" || m.homeClubId !== plan.fixture.match.homeClubId || m.awayClubId !== plan.fixture.match.awayClubId) return null;
      const [existingLineup] = await tx.select({ id: matchLineups.id }).from(matchLineups).where(eq(matchLineups.matchId, m.id)).limit(1);
      const [existingSubmission] = await tx.select({ id: matchDspSubmissions.id }).from(matchDspSubmissions).where(eq(matchDspSubmissions.matchId, m.id)).limit(1);
      if (existingLineup || existingSubmission) return null;
      const sideClubs = [m.homeClubId!, m.awayClubId!];
      const eligible = await getEligibleMatchPlayers(m.tournamentId, sideClubs, tx);
      const [ku] = await tx.select({ rules: ageCategories.rules }).from(tournaments).leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId)).where(eq(tournaments.id, m.tournamentId));
      const selections = teamSelections(eligible, sideClubs, ku?.rules ?? null);
      const assigned = plan.coaches.map((c) => accounts.get(c.id)!);
      for (const account of assigned) {
        const [current] = await tx.select({ active: users.active, role: users.role, clubId: users.clubId }).from(users).where(eq(users.id, account.userId));
        if (!current?.active || current.role !== "coach" || current.clubId !== account.clubId) throw new Error("Penugasan akun pelatih berubah selama seed.");
      }
      await tx.insert(matchLineups).values(selections.flatMap((team, i) => team.map((p, index) => ({ matchId: m.id, clubId: sideClubs[i], playerId: p.playerId,
        role: p.role, slot: eligible.find((e) => e.id === p.playerId)!.position, shirtNumber: eligible.find((e) => e.id === p.playerId)!.jersey, isCaptain: index === 1 }))));
      await tx.insert(matchDspSubmissions).values(assigned.map((c) => ({ matchId: m.id, clubId: c.clubId, submittedBy: c.userId, coachName: c.name, submittedAt: new Date() })));
      await tx.insert(auditLogs).values({ actorName: "Seed DSP", actorRole: "system", action: SEED_ACTION, entityType: "match", entityId: m.id,
        summary: `Seed DSP kedua tim: ${assigned.map((c) => c.name).join(" / ")}`, after: { coaches: assigned.map((c) => ({ coachId: c.coachId, userId: c.userId, clubId: c.clubId })), players: selections } });
      return { matchId: m.id, kuId: m.tournamentId, competition: plan.fixture.competition, age: plan.fixture.age, home: plan.fixture.homeName, away: plan.fixture.awayName,
        teams: assigned.map((c, i) => ({ coach: c.name, email: c.email, starters: selections[i].filter((p) => p.role === "starter").length, substitutes: selections[i].filter((p) => p.role === "substitute").length })) };
    });
    if (result) results.push(result);
    else skipped.push({ matchId: plan.fixture.match.id, reason: "Pertandingan atau susunan pemain sudah berubah" });
  }
  return { dryRun: !!options.dryRun, seededBefore: seededRows.length, demoCoachConnected, accounts: [...accounts.values()], matches: results, skipped };
}
