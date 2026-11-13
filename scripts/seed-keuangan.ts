import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

/**
 * Loads the six Buku-besar workbooks into the Keuangan module.
 *
 *   npm run db:seed:finance                       write the workbook data (skips what is already there)
 *   npm run db:seed:finance -- --dry-run          show what would be written, change nothing
 *   npm run db:seed:finance -- --reset            replace the seeded units' rows with the workbook data
 *   FINANCE_UNIT_PASSWORD=… npm run db:seed:finance   also create one login per unit (parfum@…, kursi@…)
 *
 * Safe to re-run: a table that already has rows for a unit is skipped, and no other table is touched.
 * The target database is whatever DATABASE_URL points at — the host is printed first so a
 * production URL cannot slip by unnoticed. Requires migration 0008 (`npm run db:migrate`).
 */
async function main() {
  const args = process.argv.slice(2);
  const known = /^(--dry-run|--reset)$/;
  if (args.some((a) => !known.test(a))) throw new Error("Usage: npm run db:seed:finance -- [--dry-run] [--reset]");
  // npm's Windows launcher can swallow flags as npm configuration; honour that for --dry-run.
  const dryRun = args.includes("--dry-run") || process.env.npm_config_dry_run === "true";
  const reset = args.includes("--reset") || process.env.npm_config_reset === "true";

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const target = new URL(url);
  console.log(`Database: ${target.hostname}:${target.port || "3306"}${target.pathname}${dryRun ? "  (dry run)" : ""}`);

  const password = process.env.FINANCE_UNIT_PASSWORD;
  if (password && (password.length < 8 || password.length > 72)) throw new Error("FINANCE_UNIT_PASSWORD must be 8–72 characters.");

  const { db } = await import("@/lib/db");
  const { seedFinance } = await import("@/lib/finance/seed");
  const report = await seedFinance(db, { dryRun, reset, accountPassword: password });

  for (const u of report.units) console.log(`unit      ${u.code.padEnd(8)} ${u.created ? "created" : "already there"}`);
  for (const t of report.tables) {
    const note = t.action === "skipped" ? `skipped — ${t.existing} rows already there` : `${t.action} ${t.rows} rows`;
    console.log(`table     ${t.table.padEnd(18)} ${t.unit.padEnd(8)} ${note}`);
  }
  for (const a of report.accounts) console.log(`login     ${a.email.padEnd(24)} ${a.created ? "created" : "already there (password unchanged)"}`);
  if (!password) console.log("logins    skipped — set FINANCE_UNIT_PASSWORD to create one login per unit");
  console.log(dryRun ? "Preview only; nothing was written." : "Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Finance seed failed");
    process.exit(1);
  });
