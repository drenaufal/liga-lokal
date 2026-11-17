import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  if (args.some((a) => !/^(--dry-run|--matches=\d+|--per-ku=\d+)$/.test(a))) throw new Error("Usage: npm run db:seed:dsp -- [--dry-run] [--matches=6] [--per-ku=2]");
  const { db } = await import("@/lib/db");
  const { seedCoachDsp } = await import("@/lib/db/seed-coach-dsp");
  // npm's Windows launcher can consume these flags as npm configuration.
  // Honor that configuration too, especially to keep --dry-run read-only.
  const result = await seedCoachDsp(db, { dryRun: args.includes("--dry-run") || process.env.npm_config_dry_run === "true",
    maxMatches: Number(args.find((a) => a.startsWith("--matches="))?.split("=")[1] ?? process.env.npm_config_matches ?? 6),
    perKu: Number(args.find((a) => a.startsWith("--per-ku="))?.split("=")[1] ?? process.env.npm_config_per_ku ?? 2) });
  console.log(JSON.stringify(result, null, 2));
  console.log(result.dryRun ? "Preview only; no data changed." : `Created ${result.matches.length * 2} DSP submissions across ${result.matches.length} matches; ${result.accounts.filter((a) => a.created).length} new coach accounts.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : "DSP seed failed"); process.exit(1); });
