/**
 * Integration checks against an isolated local MariaDB database. The named
 * database must not exist: this script creates it, migrates it, then removes it.
 * MATCH_TEST_DATABASE_URL=mysql://root@127.0.0.1:3306/footgrit_test_operators
 * npm run test:match-operators
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";

async function main() {
  const target = process.env.MATCH_TEST_DATABASE_URL;
  if (!target) throw new Error("Set MATCH_TEST_DATABASE_URL to a new footgrit_test_* database on localhost.");
  const uri = new URL(target);
  const name = uri.pathname.slice(1);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(uri.hostname) || !/^footgrit_test_[a-z0-9_]+$/.test(name))
    throw new Error("Integration tests only create a footgrit_test_* database on localhost.");
  const adminUri = new URL(uri);
  adminUri.pathname = "/";
  const admin = await mysql.createConnection(adminUri.toString());
  let created = false;
  try {
    // No IF NOT EXISTS: never run tests against or drop somebody else's database.
    await admin.query(`CREATE DATABASE \`${name}\``);
    created = true;
    process.env.DATABASE_URL = target;
    const { db } = await import("@/lib/db");
    const s = await import("@/lib/db/schema");
    const { getAssignedOperators, saveMatchOfficials, startAssignedMatch, officialAssignmentConflicts } = await import("@/lib/match-officials");
    const { recordQuickEvent, undoQuickEvent } = await import("@/lib/match-events");
    const { recomputeMatchScore } = await import("@/lib/match-engine");
    const { getMatchConsole } = await import("@/lib/queries/match");

    // Migrate the old schema first, insert a legacy assignment, then upgrade.
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    const baseline = await mkdtemp(join(tmpdir(), "footgrit-operator-migrations-"));
    await mkdir(join(baseline, "meta"));
    const entries = journal.entries.filter((entry) => entry.tag !== "0005_match_operators");
    await writeFile(join(baseline, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
    for (const entry of entries) await copyFile(`drizzle/${entry.tag}.sql`, join(baseline, `${entry.tag}.sql`));
    await migrate(db, { migrationsFolder: baseline });

    const ids = Object.fromEntries(["op1", "op2", "admin", "viewer", "inactive", "ref", "expired", "competition", "ku", "home", "away", "homePlayer", "awayPlayer", "assistPlayer", "match", "other"].map((key) => [key, crypto.randomUUID()]));
    await db.insert(s.users).values([
      { id: ids.op1, name: "Operator One", email: "one@test.invalid", passwordHash: "test", role: "operator" },
      { id: ids.op2, name: "Operator Two", email: "two@test.invalid", passwordHash: "test", role: "operator" },
      { id: ids.admin, name: "Admin", email: "admin@test.invalid", passwordHash: "test", role: "admin" },
      { id: ids.viewer, name: "Viewer", email: "viewer@test.invalid", passwordHash: "test", role: "viewer" },
      { id: ids.inactive, name: "Inactive", email: "inactive@test.invalid", passwordHash: "test", role: "operator", active: false },
    ]);
    await db.insert(s.referees).values([
      { id: ids.ref, fullName: "Referee", licenseLevel: "C-3", licenseNumber: "TEST-REF", licenseExpiry: "2099-12-31" },
      { id: ids.expired, fullName: "Expired Referee", licenseLevel: "C-3", licenseNumber: "TEST-EXPIRED", licenseExpiry: "2000-01-01" },
    ]);
    await db.insert(s.competitions).values({ id: ids.competition, name: "Test", slug: "test", season: "2026" });
    await db.insert(s.tournaments).values({ id: ids.ku, competitionId: ids.competition, format: "league", tiebreakers: ["points"] });
    await db.insert(s.clubs).values([
      { id: ids.home, name: "Home", shortName: "H", slug: "test-home", city: "Test" },
      { id: ids.away, name: "Away", shortName: "A", slug: "test-away", city: "Test" },
    ]);
    const scheduledAt = new Date("2026-10-11T09:30:00+07:00");
    await db.insert(s.matches).values([
      { id: ids.match, tournamentId: ids.ku, homeClubId: ids.home, awayClubId: ids.away, scheduledAt, refereeId: ids.ref, operatorId: ids.op1 },
      { id: ids.other, tournamentId: ids.ku, homeClubId: ids.home, awayClubId: ids.away, scheduledAt },
    ]);
    await migrate(db, { migrationsFolder: "drizzle" });
    assert.deepEqual((await getAssignedOperators(ids.match, ids.op1)).map((o) => o.id), [ids.op1]);
    assert.equal((await db.select().from(s.matchOperators).where(eq(s.matchOperators.matchId, ids.match))).length, 1);
    console.log("✓ Migration preserves the legacy operator without duplicates");

    const save = (operatorIds: string[], refereeId: string | null = ids.ref) => saveMatchOfficials({ matchId: ids.match, refereeId, operatorIds });
    await save([ids.op2, ids.op1, ids.op2, ids.admin]);
    assert.equal((await getAssignedOperators(ids.match, null)).length, 3);
    assert.deepEqual((await save([ids.op1, ids.op2])).before.operatorIds, [ids.op1, ids.op2, ids.admin].sort());
    for (const bad of [ids.viewer, ids.inactive, crypto.randomUUID(), "not-an-id"]) {
      await assert.rejects(save([ids.op1, bad]));
      assert.equal((await getAssignedOperators(ids.match, null)).length, 2);
    }
    await assert.rejects(save([ids.op1], ids.expired));
    assert.equal((await getAssignedOperators(ids.match, null)).length, 2);
    console.log("✓ Multiple operators, deduplication, admin selection, and invalid-assignment rollback");

    await db.insert(s.matchOperators).values({ matchId: ids.other, userId: ids.op2 });
    const warnings = await officialAssignmentConflicts({ id: ids.match, scheduledAt }, null, [{ id: ids.op2, name: "Operator Two" }]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Operator Two/);
    await db.update(s.matches).set({ status: "completed" }).where(eq(s.matches.id, ids.other));
    assert.equal((await officialAssignmentConflicts({ id: ids.match, scheduledAt }, null, [{ id: ids.op2, name: "Operator Two" }])).length, 0);
    console.log("✓ Secondary operators receive conflict warnings; finished matches are excluded");

    await save([]);
    assert.equal((await getAssignedOperators(ids.match, null)).length, 0);
    await assert.rejects(startAssignedMatch(ids.match, 60), /minimal satu operator/);
    await save([ids.op1], null);
    await assert.rejects(startAssignedMatch(ids.match, 60), /wasit/);
    await save([ids.op1, ids.op2]);
    // A secondary operator still satisfies kick-off if a legacy pointer is absent.
    await db.update(s.matches).set({ operatorId: null }).where(eq(s.matches.id, ids.match));
    const kickoffs = await Promise.allSettled([startAssignedMatch(ids.match, 60), startAssignedMatch(ids.match, 60)]);
    assert.equal(kickoffs.filter((result) => result.status === "fulfilled").length, 1);
    await assert.rejects(save([ids.op1]), /sebelum pertandingan/);
    console.log("✓ Kick-off requires referee and at least one operator; live assignments stay locked");

    await db.insert(s.players).values([
      { id: ids.homePlayer, fullName: "Home Player", clubId: ids.home, registrationNo: "TEST-H", nisn: "1000000001", dob: "2012-01-01", position: "ST" },
      { id: ids.awayPlayer, fullName: "Away Player", clubId: ids.away, registrationNo: "TEST-A", nisn: "1000000002", dob: "2012-01-01", position: "ST" },
      { id: ids.assistPlayer, fullName: "Home Assister", clubId: ids.home, registrationNo: "TEST-S", nisn: "1000000003", dob: "2012-01-01", position: "CMF" },
    ]);
    const event = (userId: string, clubId: string, playerId: string, type: "goal" | "assist" | "yellow_card") => recordQuickEvent({ matchId: ids.match, clubId, playerId, type, userId });
    // Both operators record BOTH teams, including simultaneous goals.
    const recorded = await Promise.all([
      event(ids.op1, ids.home, ids.homePlayer, "goal"),
      event(ids.op2, ids.away, ids.awayPlayer, "goal"),
      event(ids.op2, ids.home, ids.homePlayer, "goal"),
      event(ids.op1, ids.away, ids.awayPlayer, "goal"),
    ]);
    const score = async () => (await db.select().from(s.matches).where(eq(s.matches.id, ids.match)))[0];
    assert.equal((await score()).homeScore, 2);
    assert.equal((await score()).awayScore, 2);
    await Promise.all(Array.from({ length: 8 }, () => recomputeMatchScore(ids.match)));
    assert.equal((await score()).homeScore, 2);
    const consoleData = await getMatchConsole(ids.match);
    assert.equal(consoleData?.operators.length, 2);
    assert.deepEqual(new Set(consoleData?.events.map((e) => e.recorderName)), new Set(["Operator One", "Operator Two"]));
    console.log("✓ Both operators record either team concurrently; scores and recorder names stay correct");

    await event(ids.op2, ids.home, ids.assistPlayer, "assist");
    const linked = (await db.select().from(s.matchEvents)).filter((e) => e.type === "goal" && e.relatedPlayerId === ids.assistPlayer);
    assert.equal(linked.length, 1);
    assert.equal(linked[0].createdBy, ids.op2);
    console.log("✓ An operator can attach an assist to a goal recorded by their colleague");

    await Promise.all([
      event(ids.op1, ids.home, ids.homePlayer, "yellow_card"),
      event(ids.op2, ids.home, ids.homePlayer, "yellow_card"),
    ]);
    const cards = (await db.select().from(s.matchEvents)).filter((e) => e.type === "yellow_card" || e.type === "second_yellow");
    assert.deepEqual(cards.map((e) => e.type).sort(), ["second_yellow", "yellow_card"]);
    console.log("✓ Concurrent cards correctly become first and second yellows");

    await assert.rejects(undoQuickEvent({ matchId: ids.match, eventId: recorded[0].eventId, userId: ids.op2, isAdmin: false }), /pencatat/);
    await undoQuickEvent({ matchId: ids.match, eventId: recorded[0].eventId, userId: ids.op1, isAdmin: false });
    assert.equal((await score()).homeScore, 1);
    console.log("✓ Quick undo protects another recorder's event and refreshes the score");
    console.log("All multi-operator integration checks passed.");
  } finally {
    const pool = (globalThis as unknown as { mysqlPool?: { end: () => Promise<void> } }).mysqlPool;
    if (created) {
      await pool?.end();
      await admin.query(`DROP DATABASE \`${name}\``);
    }
    await admin.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
