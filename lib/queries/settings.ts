import { count, desc, eq, like, sql, and, ne, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { canSeeRole, type Role } from "@/lib/auth/rbac";

/** `viewer` is the signed-in role: the hidden Super Admin account is only listed to itself. */
export async function getSettingsData(viewer?: Role | null) {
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
      .where(canSeeRole(viewer, "super_admin") ? undefined : ne(users.role, "super_admin"))
      .orderBy(users.role),
    db
      .select({
        players: sql<number>`(select count(*) from players)`,
        clubs: sql<number>`(select count(*) from clubs)`,
        referees: sql<number>`(select count(*) from referees)`,
        coaches: sql<number>`(select count(*) from coaches)`,
        ageCategories: sql<number>`(select count(*) from age_categories)`,
        venues: sql<number>`(select count(*) from venues)`,
        competitions: sql<number>`(select count(*) from competitions)`,
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

/** Hide what the Super Admin did from everyone else; they only see the actions, never the actor. */
export function maskHiddenActor<T extends { actorName: string | null; actorRole: string | null }>(
  row: T,
  viewer?: Role | null,
): T {
  return row.actorRole === "super_admin" && !canSeeRole(viewer, "super_admin")
    ? { ...row, actorName: null, actorRole: null }
    : row;
}

export async function getAuditLog(params: AuditParams, viewer?: Role | null) {
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

  return {
    rows: rows.map((r) => maskHiddenActor(r, viewer)),
    total: total[0].n,
    page,
    size,
    actions: actions.map((a) => a.action),
  };
}
