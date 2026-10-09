import { count, desc, eq, like, sql, and, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";

export async function getSettingsData() {
  const [userList, counts] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        title: users.title,
        active: users.active,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(users.role),
    db
      .select({
        players: sql<number>`(select count(*) from players)`,
        clubs: sql<number>`(select count(*) from clubs)`,
        referees: sql<number>`(select count(*) from referees)`,
        coaches: sql<number>`(select count(*) from coaches)`,
        ageCategories: sql<number>`(select count(*) from age_categories)`,
        venues: sql<number>`(select count(*) from venues)`,
        tournaments: sql<number>`(select count(*) from tournaments)`,
        matches: sql<number>`(select count(*) from matches)`,
        events: sql<number>`(select count(*) from match_events)`,
        auditEntries: sql<number>`(select count(*) from audit_logs)`,
      })
      .from(sql`(select 1) as _`),
  ]);
  return { users: userList, counts: counts[0] };
}

export type AuditParams = { q?: string; action?: string; page?: string };

export async function getAuditLog(params: AuditParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const size = 30;
  const conds: SQL[] = [];
  if (params.q) conds.push(like(auditLogs.summary, `%${params.q}%`));
  if (params.action) conds.push(eq(auditLogs.action, params.action));
  const where = conds.length ? and(...conds) : undefined;

  const [rows, total, actions] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(size)
      .offset((page - 1) * size),
    db.select({ n: count() }).from(auditLogs).where(where),
    db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(auditLogs.action),
  ]);

  return { rows, total: total[0].n, page, size, actions: actions.map((a) => a.action) };
}
