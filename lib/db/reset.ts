import { config } from "dotenv";
config({ path: ".env.local" });

import { createPool } from "./pool";

const TABLES = [
  "player_match_stats",
  "audit_logs",
  "ai_reports",
  "scout_shortlists",
  "import_rows",
  "import_batches",
  "match_lineups",
  "match_events",
  "matches",
  "standings",
  "tournament_squad",
  "tournament_teams",
  "tournaments",
  "competitions",
  "player_badges",
  "player_season_history",
  "player_stats",
  "players",
  "badges",
  "coaches",
  "referees",
  "clubs",
  "venues",
  "scoring_formulas",
  "age_categories",
  "media",
  "users",
];

/** Empty every table. FK checks are per-session, so it all runs on one connection. */
export async function truncateAll(uri: string) {
  const pool = createPool(uri);
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of TABLES) await conn.query(`TRUNCATE TABLE \`${t}\``);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    conn.release();
    await pool.end();
  }
}

async function main() {
  console.log("→ Truncating all tables…");
  await truncateAll(process.env.DATABASE_URL!);
  console.log("✓ Database cleared.");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("lib/db/reset.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
