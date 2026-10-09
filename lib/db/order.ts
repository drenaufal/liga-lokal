import { sql, type AnyColumn } from "drizzle-orm";

// Postgres sorts NULLs last on ASC and first on DESC; MySQL/MariaDB does the
// opposite. These keep the Postgres order for nullable sort columns.
export const ascNullsLast = (col: AnyColumn) => sql`${col} is null, ${col} asc`;
export const descNullsFirst = (col: AnyColumn) => sql`${col} is null desc, ${col} desc`;
