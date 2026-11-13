/** Integration checks create and remove a NEW footgrit_test_* database on localhost only. */
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";

async function main() {
  const target = process.env.UPDATES_TEST_DATABASE_URL;
  if (!target) throw new Error("Set UPDATES_TEST_DATABASE_URL to a new local footgrit_test_* database.");
  const uri = new URL(target), name = uri.pathname.slice(1);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(uri.hostname) || !/^footgrit_test_[a-z0-9_]+$/.test(name)) throw new Error("Only isolated local test databases are allowed.");
  const adminUri = new URL(uri); adminUri.pathname = "/";
  const admin = await mysql.createConnection(adminUri.toString());
  let created = false;
  try {
    await admin.query(`CREATE DATABASE \`${name}\``); created = true;
    process.env.DATABASE_URL = target;
    const { db } = await import("@/lib/db");
    const s = await import("@/lib/db/schema");
    const { saveCoachAccount } = await import("@/lib/coach-accounts");
    const { authenticateCredentials } = await import("@/lib/auth/credentials");
    const { submitDsp, checkDspSelections } = await import("@/lib/dsp");
    const { startAssignedMatch } = await import("@/lib/match-officials");
    const { recordQuickEvent, undoQuickEvent } = await import("@/lib/match-events");
    const { recordManualMatchEvent, voidManualMatchEvent } = await import("@/lib/manual-match-events");
    const { syncMatchStats } = await import("@/lib/match-engine");
    const { getMatchConsole } = await import("@/lib/queries/match");
    const { withMatchGoals } = await import("@/lib/queries/match-goals");
    const { awardTournamentMvp } = await import("@/lib/manual-badges");
    const { getBadgeGallery } = await import("@/lib/queries/intelligence");
    await migrate(db, { migrationsFolder: "drizzle" });
    const id = Object.fromEntries(["home", "away", "third", "age", "competition", "ku", "competition2", "ku2", "match", "otherMatch", "coach", "awayCoach", "operator", "referee", "striker", "bench", "keeper", "benchKeeper", "otherPlayer"].map((k) => [k, crypto.randomUUID()]));
    await db.insert(s.clubs).values(["home", "away", "third"].map((k) => ({ id: id[k], name: k, shortName: k, slug: k, city: "QA" })));
    await db.insert(s.ageCategories).values({ id: id.age, code: "KU-12", label: "KU 12", maxAge: 12, rules: { matchDuration: 60, halfDuration: 30, playersOnField: 2, maxSquad: 4, substitutions: "normal", ballSize: 4, fieldType: "small" } });
    await db.insert(s.competitions).values([{ id: id.competition, name: "QA Turnamen", slug: "qa", season: "2026" }, { id: id.competition2, name: "QA Lain", slug: "qa2", season: "2026" }]);
    await db.insert(s.tournaments).values([{ id: id.ku, competitionId: id.competition, ageCategoryId: id.age, format: "league", tiebreakers: ["points"] }, { id: id.ku2, competitionId: id.competition2, ageCategoryId: id.age, format: "league", tiebreakers: ["points"] }]);
    await db.insert(s.tournamentTeams).values([{ tournamentId: id.ku, clubId: id.home }, { tournamentId: id.ku, clubId: id.away }]);
    await db.insert(s.players).values(["striker", "bench", "keeper", "benchKeeper", "otherPlayer"].map((k, i) => ({ id: id[k], fullName: k, clubId: [id.home, id.home, id.away, id.away, id.third][i], ageCategoryId: id.age, registrationNo: "QA" + i, nisn: String(1000000000 + i), dob: "2014-01-01", position: k.includes("eeper") ? "GK" as const : "ST" as const })));
    await db.insert(s.coaches).values([{ id: id.coach, fullName: "QA Coach", clubId: id.home, licenseLevel: "D", licenseNumber: "QA-C" }, { id: id.awayCoach, fullName: "QA Away Coach", clubId: id.away, licenseLevel: "D", licenseNumber: "QA-A" }]);
    const account = await saveCoachAccount(id.coach, { email: "coach@qa.invalid", password: "QaPass123!", active: true });
    const awayAccount = await saveCoachAccount(id.awayCoach, { email: "away@qa.invalid", password: "QaPass123!", active: true });
    assert.equal((await authenticateCredentials({ email: "COACH@QA.INVALID", password: "QaPass123!" }))?.clubId, id.home);
    await assert.rejects(saveCoachAccount(id.awayCoach, { email: "coach@qa.invalid", password: "QaPass123!", active: true }), /Email/);
    await saveCoachAccount(id.coach, { email: "coach@qa.invalid", password: "", active: false });
    assert.equal(await authenticateCredentials({ email: "coach@qa.invalid", password: "QaPass123!" }), null);
    await saveCoachAccount(id.coach, { email: "coach@qa.invalid", password: "", active: true });
    console.log("✓ Coach accounts authenticate, retain passwords on edit, reject duplicates and honor deactivation");
    await db.insert(s.users).values({ id: id.operator, name: "Operator", email: "operator@qa.invalid", passwordHash: "test", role: "operator" });
    await db.insert(s.referees).values({ id: id.referee, fullName: "Referee", licenseLevel: "C", licenseNumber: "QA-R", licenseExpiry: "2099-01-01" });
    await db.insert(s.matches).values([{ id: id.match, tournamentId: id.ku, homeClubId: id.home, awayClubId: id.away, scheduledAt: new Date("2026-12-01T08:00:00Z"), refereeId: id.referee, operatorId: id.operator }, { id: id.otherMatch, tournamentId: id.ku, homeClubId: id.away, awayClubId: id.third, scheduledAt: new Date("2026-12-02T08:00:00Z") }]);
    const homeDsp = { matchId: id.match, coachName: "QA Coach", selections: [{ playerId: id.striker, role: "starter" as const }, { playerId: id.bench, role: "substitute" as const }] };
    await assert.rejects(submitDsp(id.operator, homeDsp), /pelatih/);
    await assert.rejects(submitDsp(account.id, { ...homeDsp, matchId: id.otherMatch }), /klub/);
    await assert.rejects(submitDsp(account.id, { ...homeDsp, selections: [{ playerId: id.keeper, role: "starter" }] }), /terdaftar/);
    await assert.rejects(submitDsp(account.id, { ...homeDsp, selections: [...homeDsp.selections, homeDsp.selections[0]] }), /terdaftar/);
    await assert.rejects(submitDsp(account.id, { ...homeDsp, selections: [{ playerId: id.bench, role: "substitute" }] }), /starter/);
    assert.throws(() => checkDspSelections(["1", "2", "3"].map((playerId) => ({ playerId, role: "starter" })), ["1", "2", "3"], { playersOnField: 2, maxSquad: 4 }), /Maksimal/);
    assert.throws(() => checkDspSelections(["1", "2", "3", "4", "5"].map((playerId) => ({ playerId, role: playerId === "1" ? "starter" : "substitute" })), ["1", "2", "3", "4", "5"], { playersOnField: 2, maxSquad: 4 }), /Maksimal/);
    await submitDsp(account.id, homeDsp);
    await submitDsp(awayAccount.id, { matchId: id.match, coachName: "QA Away Coach", selections: [{ playerId: id.keeper, role: "starter" }, { playerId: id.benchKeeper, role: "substitute" }] });
    await submitDsp(account.id, { ...homeDsp, coachName: "QA Revised" });
    assert.equal((await db.select().from(s.matchLineups).where(eq(s.matchLineups.matchId, id.match))).length, 4);
    const [card] = await withMatchGoals([{ id: id.match }]);
    assert.equal(card.homeDspSubmitted, true); assert.equal(card.awayDspSubmitted, true);
    assert.equal((await db.select().from(s.matchDspSubmissions)).length, 2);
    console.log("✓ DSP restricts role, club, KU and roster; revisions preserve the opponent and both schedule statuses");
    const racing = await Promise.allSettled([submitDsp(account.id, homeDsp), startAssignedMatch(id.match, 60)]);
    assert.equal(racing[1].status, "fulfilled");
    await assert.rejects(submitDsp(account.id, homeDsp), /terkunci/);
    console.log("✓ Kick-off and DSP serialize safely; starting a match locks revisions");
    const quick = (playerId: string, clubId: string, type: "shot_on" | "goal") => recordQuickEvent({ matchId: id.match, clubId, playerId, type, userId: id.operator });
    await assert.rejects(quick(id.bench, id.home, "goal"), /cadangan/);
    await assert.rejects(recordManualMatchEvent({ matchId: id.match, type: "save", clubId: id.away, playerId: id.keeper, minute: 1 }, id.operator), /otomatis/);
    const firstShot = await quick(id.striker, id.home, "shot_on");
    await undoQuickEvent({ matchId: id.match, eventId: firstShot.eventId, userId: id.operator, isAdmin: false });
    const event = (type: "shot_on" | "substitution" | "goal", clubId: string, playerId: string, minute: number, relatedPlayerId?: string) => recordManualMatchEvent({ matchId: id.match, type, clubId, playerId, minute, relatedPlayerId }, id.operator);
    await event("shot_on", id.home, id.striker, 10);
    await assert.rejects(event("substitution", id.away, id.keeper, 20, id.striker), /dipilih/);
    await event("substitution", id.away, id.keeper, 20, id.benchKeeper);
    await db.update(s.matches).set({ currentMinute: 25, clockStartedAt: null }).where(eq(s.matches.id, id.match));
    await assert.rejects(quick(id.keeper, id.away, "goal"), /keluar/);
    await quick(id.striker, id.home, "shot_on");
    await event("goal", id.away, id.benchKeeper, 26);
    const data = await getMatchConsole(id.match);
    const substitution = data!.events.find((e) => e.type === "substitution")!;
    await assert.rejects(voidManualMatchEvent(id.match, substitution.id, "QA"), /bergantung/);
    await assert.rejects(voidManualMatchEvent(id.otherMatch, substitution.id, "QA"), /pertandingan ini/);
    await db.update(s.matches).set({ status: "completed", currentMinute: 60 }).where(eq(s.matches.id, id.match));
    await syncMatchStats(id.match, DEFAULT_WEIGHTS); await syncMatchStats(id.match, DEFAULT_WEIGHTS);
    let keeperStats = await db.select().from(s.playerStats).where(and(eq(s.playerStats.playerId, id.benchKeeper), eq(s.playerStats.tournamentId, id.ku)));
    assert.equal(keeperStats[0].saves, 1); assert.equal(keeperStats[0].minutesPlayed, 40);
    const oldKeeperStats = await db.select().from(s.playerStats).where(and(eq(s.playerStats.playerId, id.keeper), eq(s.playerStats.tournamentId, id.ku)));
    assert.equal(oldKeeperStats[0].saves, 1);
    const secondShot = data!.events.find((e) => e.type === "shot_on" && e.minute === 25)!;
    await voidManualMatchEvent(id.match, secondShot.id, "QA correction"); await syncMatchStats(id.match, DEFAULT_WEIGHTS);
    keeperStats = await db.select().from(s.playerStats).where(and(eq(s.playerStats.playerId, id.benchKeeper), eq(s.playerStats.tournamentId, id.ku)));
    assert.equal(keeperStats[0].saves, 0);
    console.log("✓ Save removal, goalkeeper substitution, bench/off guards, correction rollback and idempotent statistics");
    await db.insert(s.playerStats).values({ playerId: id.striker, tournamentId: id.ku2, season: "2026", score: 50 });
    await awardTournamentMvp({ kuId: id.ku, playerId: id.striker });
    const scoped = await getBadgeGallery({ turnamen: id.competition });
    const mvp = scoped.badges.find((b) => b.code === "mvp_tournament")!;
    const score = (await db.select().from(s.playerStats).where(and(eq(s.playerStats.playerId, id.striker), eq(s.playerStats.tournamentId, id.ku))))[0].score;
    assert.equal(mvp.awards[0].score, score);
    assert.equal((await getBadgeGallery({ ku: id.age })).badges.find((b) => b.code === "mvp_tournament")!.awards[0].score, score + 50);
    await awardTournamentMvp({ kuId: id.ku, playerId: id.keeper });
    assert.equal((await getBadgeGallery({ turnamen: id.competition })).badges.find((b) => b.code === "mvp_tournament")!.awards.length, 1);
    await assert.rejects(awardTournamentMvp({ kuId: id.ku, playerId: id.otherPlayer }), /terdaftar/);
    console.log("✓ Manual MVP replaces only its KU, rejects outsiders and displays scores scoped to competition/KU");
    const { seedCoachDsp } = await import("@/lib/db/seed-coach-dsp");
    const draftMatch = crypto.randomUUID(), seedMatch = crypto.randomUUID(), thirdCoach = crypto.randomUUID(), demoCoach = crypto.randomUUID();
    await db.update(s.clubs).set({ shortName: "GMF" }).where(eq(s.clubs.id, id.home));
    await db.insert(s.users).values({ id: demoCoach, name: "Demo Coach", email: "pelatih@ligalokal.id", role: "coach", passwordHash: "preserve-existing-password" });
    await db.insert(s.coaches).values({ id: thirdCoach, fullName: "Third Coach", clubId: id.third, licenseLevel: "D", licenseNumber: "QA-THIRD", email: "third@qa.invalid", specialty: "Pelatih Kepala" });
    await db.insert(s.players).values([
      { fullName: "Home GK", clubId: id.home, ageCategoryId: id.age, registrationNo: "QA-SEED-H", nisn: "1000000010", dob: "2014-01-01", position: "GK" },
      { fullName: "Away Striker", clubId: id.away, ageCategoryId: id.age, registrationNo: "QA-SEED-A", nisn: "1000000011", dob: "2014-01-01", position: "ST" },
      { fullName: "Third GK", clubId: id.third, ageCategoryId: id.age, registrationNo: "QA-SEED-T", nisn: "1000000012", dob: "2014-01-01", position: "GK" },
      { fullName: "Third Bench", clubId: id.third, ageCategoryId: id.age, registrationNo: "QA-SEED-B", nisn: "1000000013", dob: "2014-01-01", position: "ST" },
    ]);
    await db.insert(s.tournamentTeams).values({ tournamentId: id.ku, clubId: id.third });
    await db.insert(s.matches).values([
      { id: draftMatch, tournamentId: id.ku, homeClubId: id.home, awayClubId: id.away, scheduledAt: new Date("2026-11-01T08:00:00Z") },
      { id: seedMatch, tournamentId: id.ku, homeClubId: id.home, awayClubId: id.away, scheduledAt: new Date("2026-11-02T08:00:00Z") },
    ]);
    await db.insert(s.matchLineups).values({ matchId: draftMatch, clubId: id.home, playerId: id.striker, shirtNumber: 99 });
    const beforePassword = (await db.select({ hash: s.users.passwordHash }).from(s.users).where(eq(s.users.id, account.id)))[0].hash;
    const preview = await seedCoachDsp(db, { maxMatches: 2, perKu: 2, dryRun: true });
    assert.equal(preview.matches.length, 2);
    assert.equal((await db.select().from(s.matchDspSubmissions)).length, 2);
    assert.equal((await db.select().from(s.users).where(eq(s.users.id, demoCoach)))[0].clubId, null);
    const seeded = await seedCoachDsp(db, { maxMatches: 2, perKu: 2 });
    assert.equal(seeded.matches.length, 2); assert.equal(seeded.accounts.filter((a) => a.created).length, 1);
    assert.equal(seeded.demoCoachConnected, true);
    const [seedCard] = await withMatchGoals([{ id: seedMatch }]);
    assert.equal(seedCard.homeDspSubmitted, true); assert.equal(seedCard.awayDspSubmitted, true);
    const lineup = await db.select().from(s.matchLineups).where(eq(s.matchLineups.matchId, seedMatch));
    assert.equal(lineup.filter((p) => p.role === "starter").length, 4); assert.equal(lineup.filter((p) => p.role === "substitute").length, 2);
    assert.equal((await db.select().from(s.matchLineups).where(eq(s.matchLineups.matchId, draftMatch)))[0].shirtNumber, 99);
    assert.equal((await db.select().from(s.matchDspSubmissions).where(eq(s.matchDspSubmissions.matchId, id.match))).length, 2);
    assert.equal((await db.select({ hash: s.users.passwordHash }).from(s.users).where(eq(s.users.id, account.id)))[0].hash, beforePassword);
    assert.equal((await db.select().from(s.users).where(eq(s.users.id, demoCoach)))[0].passwordHash, "preserve-existing-password");
    const { DEMO_PASSWORD } = await import("@/lib/demo-accounts");
    assert.equal((await authenticateCredentials({ email: "third@qa.invalid", password: DEMO_PASSWORD }))?.clubId, id.third);
    assert.equal((await seedCoachDsp(db, { maxMatches: 2, perKu: 2 })).matches.length, 0);
    assert.equal((await db.select().from(s.matchDspSubmissions)).length, 6);
    console.log("✓ DSP seed previews without writes, creates coach accounts, populates both teams, preserves existing data/passwords, and is repeatable");
  } finally {
    if (created) await admin.query(`DROP DATABASE \`${name}\``);
    await admin.end();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
