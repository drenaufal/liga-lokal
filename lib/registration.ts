import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";

const PREFIX = "FG-2026-";

/**
 * The next `n` registration numbers, counted from the highest one in use. The
 * number of players is not a safe base: once a player has been deleted the
 * count falls behind the numbers already handed out and new ones would collide.
 */
export async function nextRegistrationNumbers(n = 1): Promise<string[]> {
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(cast(substring_index(${players.registrationNo}, '-', -1) as unsigned)), 0)`,
    })
    .from(players);
  const start = Number(row?.max ?? 0) + 1;
  return Array.from({ length: n }, (_, i) => `${PREFIX}${String(start + i).padStart(5, "0")}`);
}

/**
 * Name of the unique index a failed insert collided with (e.g. `players_nisn_unique`),
 * or null when the error is not a duplicate-key error. Reads the database's own
 * message — the wrapper's text also contains the whole SQL statement, which
 * mentions every column.
 */
export function duplicateKeyOf(e: unknown): string | null {
  const err = e as { code?: string; sqlMessage?: string; message?: string; cause?: unknown };
  const cause = (err?.cause ?? err) as { code?: string; sqlMessage?: string; message?: string };
  if ((cause.code ?? err.code) !== "ER_DUP_ENTRY") return null;
  const text = cause.sqlMessage ?? cause.message ?? "";
  return text.match(/for key '([^']+)'/)?.[1] ?? "";
}
