import { sql } from "drizzle-orm";
import { ageCategories, competitions } from "@/lib/db/schema";

/**
 * SQL for a KU's display name, "<turnamen> · <KU code>". The query must join
 * `competitions` (on tournaments.competition_id) and, to get the code,
 * `ageCategories` (on tournaments.age_category_id). Same format as `kuLabel`.
 */
export const kuNameSql = sql<string>`concat(${competitions.name}, coalesce(concat(' · ', ${ageCategories.code}), ''))`;
