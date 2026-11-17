/** Isolated integration checks. Only a new footgrit_test_* database on localhost is allowed. */
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";

async function main() {
  const target = process.env.INTELLIGENCE_TEST_DATABASE_URL;
  if (!target) throw new Error("Set INTELLIGENCE_TEST_DATABASE_URL to a new local footgrit_test_* database.");
  const uri = new URL(target);
  const name = uri.pathname.slice(1);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(uri.hostname) || !/^footgrit_test_[a-z0-9_]+$/.test(name)) throw new Error("Only isolated local test databases are allowed.");
  const adminUri = new URL(uri); adminUri.pathname = "/";
  const admin = await mysql.createConnection(adminUri.toString());
  let created = false;
  try {
    await admin.query(`CREATE DATABASE \`${name}\``); created = true;
    process.env.DATABASE_URL = target;
    const { db } = await import("@/lib/db");
    const s = await import("@/lib/db/schema");
    const { searchPlayersForRadar, getBadgeGallery, getFormulaData } = await import("@/lib/queries/intelligence");
    const { createOperatorAccount, updateOperatorAccount, makeNewOperatorSchema, makeEditOperatorSchema, OperatorEmailExists } = await import("@/lib/operator-accounts");
    const { createT } = await import("@/lib/i18n/translate");
    const newOperatorSchema = makeNewOperatorSchema(createT("id", {}));
    const editOperatorSchema = makeEditOperatorSchema(createT("id", {}));
    const { authenticateCredentials } = await import("@/lib/auth/credentials");
    await migrate(db, { migrationsFolder: "drizzle" });
    const clubA = crypto.randomUUID(), clubB = crypto.randomUUID(), age = crypto.randomUUID();
    await db.insert(s.clubs).values([{ id: clubA, name: "Club A", shortName: "A", slug: "a", city: "QA" }, { id: clubB, name: "Club B", shortName: "B", slug: "b", city: "QA" }]);
    await db.insert(s.ageCategories).values({ id: age, code: "KU-12", label: "Under 12", maxAge: 12, rules: { matchDuration: 60, halfDuration: 30, playersOnField: 11, maxSquad: 22, substitutions: "unlimited", ballSize: 4, fieldType: "full" } });
    const ids = Array.from({ length: 85 }, () => crypto.randomUUID());
    await db.insert(s.players).values(ids.map((id, i) => ({ id, fullName: "Player " + String(i).padStart(3, "0"), clubId: i % 2 ? clubB : clubA, ageCategoryId: age, registrationNo: "QA-" + i, nisn: String(1000000000 + i), dob: "2014-01-01", position: i % 2 ? "CB" as const : "ST" as const })));
    await db.insert(s.playerStats).values(ids.map((playerId, i) => ({ playerId, season: "career", appearances: i < 5 ? 1 : 5, goals: i, assists: 85 - i, score: i, rating: i % 2 ? 6 : 8, minutesPlayed: i * 60 })));
    const byGoals = await searchPlayersForRadar({ sort: "goals", order: "desc", pageSize: "12" });
    assert.equal(byGoals.total, 85); assert.equal(byGoals.rows[0].id, ids[84]); assert.equal(byGoals.rows.length, 12);
    const second = await searchPlayersForRadar({ sort: "goals", order: "desc", pageSize: "12", page: "2" });
    assert.equal(second.rows[0].id, ids[72]);
    const combined = await searchPlayersForRadar({ q: "Player", club: clubA, age: "KU-12", position: "FW", minApps: "3", minRating: "7", sort: "name", order: "asc", pageSize: "80" });
    assert.equal(combined.total, 40); assert.equal(combined.rows[0].id, ids[6]);
    assert.equal((await searchPlayersForRadar({ position: "CB", club: clubA })).total, 0);
    const end = await searchPlayersForRadar({ page: "99999", pageSize: "20" });
    assert.equal(end.page, 5); assert.equal(end.rows.length, 5);
    const preview = await getFormulaData({ minApps: "1" });
    assert.equal(preview.preview.length, 85);
    assert.equal((await getFormulaData({ club: clubA, minApps: "3", minRating: "7" })).preview.length, 40);
    console.log("✓ Player search combines filters before pagination; sorting, page clamping and full draft candidate pools work");

    const competition = crypto.randomUUID(), ku = crypto.randomUUID(), badgeA = crypto.randomUUID(), badgeB = crypto.randomUUID();
    await db.insert(s.competitions).values({ id: competition, name: "QA Competition", slug: "qa", season: "2026" });
    await db.insert(s.tournaments).values({ id: ku, competitionId: competition, ageCategoryId: age, format: "league", tiebreakers: ["points"] });
    await db.insert(s.badges).values([{ id: badgeA, code: "QA-A", name: "Scorer", description: "Goal award" }, { id: badgeB, code: "QA-B", name: "Defender", description: "Defense award" }]);
    await db.insert(s.playerBadges).values([
      { badgeId: badgeA, playerId: ids[0], tournamentId: ku, context: "a", awardedAt: new Date("2026-10-11T23:00:00+07:00") },
      { badgeId: badgeA, playerId: ids[1], tournamentId: ku, context: "b", awardedAt: new Date("2026-10-12T01:00:00+07:00") },
    ]);
    const gallery = await getBadgeGallery({ turnamen: competition, ku: age, from: "2026-10-12", to: "2026-10-12", earned: "yes" });
    assert.equal(gallery.totalAwards, 1); assert.equal(gallery.badges[0].awards[0].playerId, ids[1]);
    assert.equal((await getBadgeGallery({ club: clubA, position: "DF", earned: "yes" })).total, 0);
    assert.equal((await getBadgeGallery({ q: "Player 000" })).totalAwards, 1);
    assert.equal((await getBadgeGallery({ q: "missing" })).total, 0);
    const unearned = await getBadgeGallery({ earned: "no" });
    assert.equal(unearned.total, 1); assert.equal(unearned.badges[0].id, badgeB);
    const counts = await getBadgeGallery({ sort: "count", order: "desc" }); assert.equal(counts.badges[0].id, badgeA);
    const oldest = await getBadgeGallery({ badge: badgeA, awardSort: "oldest" }); assert.equal(oldest.badges[0].awards[0].playerId, ids[0]);
    const invalidKu = await getBadgeGallery({ turnamen: competition, ku: crypto.randomUUID() }); assert.equal(invalidKu.selectedKu, "");
    console.log("✓ Badge search, award status, scoped positions, WIB date bounds, counts and recipient ordering work");

    const password = "Operator-Test-2026";
    const input = { name: "New Operator", email: "  OPERATOR@test.invalid  ", password, active: true };
    assert(!newOperatorSchema.safeParse({ ...input, password: "short" }).success);
    assert(!newOperatorSchema.safeParse({ ...input, password: "é".repeat(40) }).success);
    const account = await createOperatorAccount(input);
    assert.equal(account.email, "operator@test.invalid");
    const stored = await db.query.users.findFirst({ where: eq(s.users.id, account.id) });
    assert.equal(stored?.role, "operator"); assert.notEqual(stored?.passwordHash, password); assert(stored?.passwordHash.startsWith("$2"));
    assert.equal((await authenticateCredentials({ email: "OPERATOR@test.invalid", password }))?.role, "operator");
    assert.equal(await authenticateCredentials({ email: account.email, password: "wrong" }), null);
    await assert.rejects(createOperatorAccount(input), OperatorEmailExists);
    const edit = editOperatorSchema.parse({ name: "Updated Operator", email: account.email, active: true, password: "" });
    const update = await updateOperatorAccount(account.id, edit);
    assert.equal(update.after.passwordChanged, false);
    assert.equal((await authenticateCredentials({ email: account.email, password }))?.name, "Updated Operator");
    await updateOperatorAccount(account.id, { ...edit, password: "Replacement-2026", active: false });
    assert.equal(await authenticateCredentials({ email: account.email, password: "Replacement-2026" }), null);
    await updateOperatorAccount(account.id, { ...edit, active: true });
    assert.equal(await authenticateCredentials({ email: account.email, password }), null);
    assert.equal((await authenticateCredentials({ email: account.email, password: "Replacement-2026" }))?.id, account.id);
    const adminId = crypto.randomUUID();
    await db.insert(s.users).values({ id: adminId, name: "Admin", email: "admin@test.invalid", role: "admin", passwordHash: "!test" });
    await assert.rejects(updateOperatorAccount(adminId, edit), /operator tidak ditemukan/);
    await assert.rejects(updateOperatorAccount(account.id, { ...edit, email: "admin@test.invalid" }), OperatorEmailExists);
    assert(!JSON.stringify(update).includes(password));
    console.log("✓ Operator creation, hashed passwords, real credential login, duplicate emails, updates, password reset and deactivation work");
  } finally {
    const pool = (globalThis as unknown as { mysqlPool?: { end: () => Promise<void> } }).mysqlPool;
    if (created) { await pool?.end(); await admin.query(`DROP DATABASE \`${name}\``); }
    await admin.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
