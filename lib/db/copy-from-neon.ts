/**
 * One-time data move: Neon Postgres (NEON_DATABASE_URL) → MariaDB/MySQL
 * (DATABASE_URL). Read-only on Neon. Empties the target tables first, so run
 * `npm run db:migrate` against the target before this.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { createPool } from "./pool";
import { truncateAll } from "./reset";

const MAX_BATCH_ROWS = 500;
const MAX_BATCH_BYTES = 4 * 1024 * 1024; // stay well under max_allowed_packet

type PgColumn = { table_name: string; column_name: string; data_type: string };

/** Cast on the Postgres side so values arrive as plain text — no driver date/JSON parsing. */
function pgSelectExpr(c: PgColumn) {
  const col = `"${c.column_name}"`;
  switch (c.data_type) {
    case "timestamp with time zone":
      return `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') as ${col}`;
    case "timestamp without time zone":
      return `to_char(${col}, 'YYYY-MM-DD HH24:MI:SS.MS') as ${col}`;
    case "date":
    case "json":
    case "jsonb":
    case "uuid":
    case "USER-DEFINED": // enums
      return `${col}::text as ${col}`;
    default:
      return col;
  }
}

async function main() {
  // Disabled until it maps the legacy Postgres shape onto the new schema (13 roles, required NISN,
  // club_id on stats): it empties the target first, then fails on the first player row.
  const DISABLED = true;
  if (DISABLED) {
    throw new Error(
      "db:copy-from-neon belum disesuaikan dengan skema baru. Salin data lewat mysqldump / impor SQL dari database lokal.",
    );
  }
  const neonUrl = process.env.NEON_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!neonUrl) throw new Error("NEON_DATABASE_URL is not set");
  if (!targetUrl?.startsWith("mysql")) throw new Error("DATABASE_URL must be a mysql:// URL");

  const target = new URL(targetUrl);
  console.log(`→ Target: ${target.hostname}${target.pathname} (its tables will be emptied)`);

  const pg = neon(neonUrl);
  const pgColumns = (await pg.query(
    `select table_name, column_name, data_type from information_schema.columns
     where table_schema = 'public' order by table_name, ordinal_position`,
  )) as PgColumn[];

  const pool = createPool(targetUrl);
  const [myRows] = await pool.query(
    "select table_name as t, column_name as c from information_schema.columns where table_schema = database()",
  );
  const myColumns = new Set((myRows as { t: string; c: string }[]).map((r) => `${r.t}.${r.c}`));
  const tables = [...new Set(pgColumns.map((c) => c.table_name))].filter((t) =>
    myColumns.has(`${t}.id`),
  );

  await truncateAll(targetUrl);

  const conn = await pool.getConnection();
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const table of tables) {
      const cols = pgColumns.filter(
        (c) => c.table_name === table && myColumns.has(`${table}.${c.column_name}`),
      );
      const rows = (await pg.query(
        `select ${cols.map(pgSelectExpr).join(", ")} from "${table}"`,
      )) as Record<string, unknown>[];

      const names = cols.map((c) => c.column_name);
      const insert = `insert into \`${table}\` (${names.map((n) => `\`${n}\``).join(", ")}) values ?`;
      let batch: unknown[][] = [];
      let bytes = 0;
      const flush = async () => {
        if (batch.length) await conn.query(insert, [batch]);
        batch = [];
        bytes = 0;
      };
      for (const row of rows) {
        const values = names.map((n) => row[n] ?? null);
        batch.push(values);
        bytes += JSON.stringify(values).length;
        if (batch.length >= MAX_BATCH_ROWS || bytes >= MAX_BATCH_BYTES) await flush();
      }
      await flush();

      const [[{ n }]] = (await conn.query(`select count(*) as n from \`${table}\``)) as unknown as [
        { n: number }[],
      ];
      const ok = n === rows.length ? "✓" : "✗ MISMATCH";
      console.log(`  ${ok} ${table.padEnd(24)} ${rows.length} → ${n}`);
    }
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    conn.release();
    await pool.end();
  }
  console.log("✓ Copy finished.");
}

main().catch((e) => {
  console.error("✗ Copy failed:", e);
  process.exit(1);
});
