import { notFound } from "next/navigation";
import { getKuFormOptions, getTournamentFixtures, getTournamentOverview } from "@/lib/queries/competition";
import { requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClubCrest } from "@/components/app/club-crest";
import { MemberLink } from "@/components/app/member-link";
import { StatusBadge } from "@/components/app/status-badge";
import { AddTeam, RemoveTeamButton } from "../team-controls";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = await getI18n();
  const user = await requireViewerCapability("competition:view");
  const { id } = await params;
  const d = await getTournamentOverview(id);
  if (!d) notFound();
  const { teams, tournament: tour } = d;
  const canManage = can(user, "ku:teams") && tour.status !== "completed" && tour.status !== "archived";

  // Only managers need to know who could still be added and who already plays.
  const [formOptions, fixtures] = canManage
    ? await Promise.all([getKuFormOptions(tour.competitionId), getTournamentFixtures(id)])
    : [null, []];
  const taken = new Set(teams.map((x) => x.clubId));
  const available = (formOptions?.clubs ?? [])
    .filter((c) => !taken.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      short: c.short,
      players: tour.ageCategoryId ? (formOptions?.playerCounts[c.id]?.[tour.ageCategoryId] ?? 0) : 0,
    }));
  const matchCount = (clubId: string) =>
    fixtures.filter((m) => m.homeClubId === clubId || m.awayClubId === clubId).length;

  const groups = [...new Set(teams.map((x) => x.group ?? "-"))].sort();

  return (
    <div className="space-y-5">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("Tambah peserta")}</CardTitle>
            <span className="text-[11px] text-ink-muted">{t("{n} SSB terdaftar", { n: teams.length })}</span>
          </CardHeader>
          <CardContent>
            <AddTeam kuId={id} options={available} ageCode={tour.ageCategory?.code ?? null} />
          </CardContent>
        </Card>
      )}

      {teams.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-xs text-ink-muted">
          {t("Belum ada SSB peserta.")}{canManage ? t(" Tambahkan dari kotak di atas.") : ""}
        </p>
      )}

      {groups.map((g) => (
        <div key={g}>
          {g !== "-" && (
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              {t("Grup {label}", { label: g })}
            </h3>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {teams
              .filter((x) => (x.group ?? "-") === g)
              .map((x) => (
                <div
                  key={x.id}
                  className="flex items-center gap-1 rounded-xl border border-line bg-surface/70 pr-2 transition-colors hover:border-brand/40"
                >
                  <MemberLink href={`/registry/klub/${x.clubId}`} className="flex min-w-0 flex-1 items-center gap-3 p-3">
                    <ClubCrest logoUrl={x.logo} short={x.short} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{x.name}</p>
                      <p className="text-[11px] text-ink-muted">{t("Unggulan {n}", { n: x.seed ?? "—" })}</p>
                    </div>
                    <StatusBadge kind="registration" value={x.regStatus} />
                  </MemberLink>
                  {canManage && (
                    <RemoveTeamButton kuId={id} clubId={x.clubId} name={x.name} matchCount={matchCount(x.clubId)} />
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
