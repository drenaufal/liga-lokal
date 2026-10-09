import { inArray } from "drizzle-orm";
import type { MySqlColumn, MySqlTable } from "drizzle-orm/mysql-core";
import type { MySql2Database } from "drizzle-orm/mysql2";

type IdTable = MySqlTable & { id: MySqlColumn };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = MySql2Database<any>;

/**
 * MySQL/MariaDB stand-in for Postgres' `INSERT … RETURNING *`: assigns the
 * UUIDs up front, inserts, then reads the rows back (with DB defaults filled
 * in) in input order.
 */
export async function insertReturning<T extends IdTable>(
  db: AnyDb,
  table: T,
  values: T["$inferInsert"] | T["$inferInsert"][],
): Promise<T["$inferSelect"][]> {
  const rows = (Array.isArray(values) ? values : [values]).map((v) => ({
    ...v,
    id: (v as { id?: string }).id ?? crypto.randomUUID(),
  }));
  if (rows.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.insert(table).values(rows as any);
  const ids = rows.map((r) => r.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = (await db.select().from(table as any).where(inArray(table.id, ids))) as (T["$inferSelect"] & {
    id: string;
  })[];
  const byId = new Map(found.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)!);
}
