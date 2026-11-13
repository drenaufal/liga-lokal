import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getCompetitionChoices, getOperatorAssignments } from "@/lib/operator-accounts";
import { PageHeader } from "@/components/app/page-header";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OperatorEdit } from "./operator-edit";
import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export default async function OperatorsPage() {
  const { t } = await getI18n();
  const user = await requireCapability("registry.operator:view");
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, active: users.active, hasPassword: sql<number>`${users.passwordHash} like '$2%'` }).from(users).where(eq(users.role, "operator")).orderBy(asc(users.name));
  const [competitions, assignments] = await Promise.all([getCompetitionChoices(), getOperatorAssignments(rows.map((r) => r.id))]);
  const byId = new Map(competitions.map((c) => [c.id, c]));
  const canCreate = can(user, "registry.operator:create");
  const canEdit = can(user, "registry.operator:edit");
  return <div><PageHeader title={t("Manajemen Operator")} description={t("Kelola akun, akses login, dan turnamen yang ditugaskan kepada petugas konsol pertandingan.")}
      actions={canCreate && <Button size="sm" href="/registry/operator/baru"><Plus className="size-3.5" /> {t("Operator Baru")}</Button>} />
    <Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-left text-sm">
      <thead><tr className="border-b border-line"><th className="p-4">{t("Nama")}</th><th className="p-4">Email</th><th className="p-4">{t("Turnamen")}</th><th className="p-4">{t("Status")}</th>{canEdit && <th className="p-4">{t("Aksi")}</th>}</tr></thead>
      <tbody>{rows.map((o) => {
        const ids = assignments.get(o.id) ?? [];
        const assigned = ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
        return <tr key={o.id} className="border-b border-line-soft align-top">
          <td className="p-4">{o.name}</td>
          <td className="p-4">{o.email}</td>
          <td className="p-4">
            {assigned.length ? (
              <ul className="flex max-w-md flex-wrap gap-1">
                {assigned.map((c) => <li key={c.id}><Badge tone="neutral">{c.name} · {c.season}</Badge></li>)}
              </ul>
            ) : (
              <span className="text-[11px] text-warn">{t("Belum ditugaskan ke turnamen")}</span>
            )}
          </td>
          <td className="p-4"><Badge tone={o.active ? "success" : "neutral"}>{o.active ? t("Aktif") : t("Nonaktif")}</Badge>{!o.hasPassword && <p className="mt-1 text-[11px] text-warn">{t("Kata sandi belum diatur")}</p>}</td>
          {canEdit && <td className="p-4"><OperatorEdit key={o.id + o.name + o.email + o.active + ids.join()} operator={{ id: o.id, name: o.name, email: o.email, active: o.active, competitionIds: ids }} competitions={competitions} /></td>}
        </tr>;
      })}</tbody>
    </table>{!rows.length && <p className="p-6 text-center text-xs text-ink-muted">{t("Belum ada operator.")}</p>}</CardContent></Card>
  </div>;
}
