import { notFound } from "next/navigation";
import {
  getCompetitionKuOptions,
  getScheduleOptions,
  getTournamentBase,
  getTournamentFixtures,
  getTournamentTeamShorts,
} from "@/lib/queries/competition";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState } from "@/components/ui/misc";
import { STAGE_LABEL } from "@/lib/status";
import { ScheduleUpload } from "../../../schedule-upload";
import { AddMatch } from "../../../add-match";
import { DeleteMatchButton } from "../../../delete-match-button";

export const dynamic = "force-dynamic";

export default async function FixturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTournamentBase(id);
  if (!t) notFound();
  const user = await getCurrentUser();
  const canManage = can(user?.role, "competition:write") && t.status !== "archived";
  const code = t.ageCategory?.code ?? t.name;

  const [matches, shorts, options, kuOptions] = await Promise.all([
    getTournamentFixtures(id),
    canManage ? getTournamentTeamShorts(id) : Promise.resolve([] as string[]),
    canManage ? getScheduleOptions() : Promise.resolve(null),
    canManage ? getCompetitionKuOptions(t.competitionId) : Promise.resolve([]),
  ]);
  const teams = kuOptions.find((k) => k.id === id)?.teams ?? [];

  // Schedule tools live here, inside the KU (and, for every KU at once, on the Turnamen's own schedule).
  const tools =
    canManage && options ? (
      <div className="flex flex-wrap items-center gap-2">
        <AddMatch
          kus={[{ id, label: code, format: t.format, hasGroups: t.groupCount > 0, status: t.status, teams }]}
          options={options}
        />
        <ScheduleUpload kus={[{ id, label: code, shorts }]} />
      </div>
    ) : null;

  if (matches.length === 0) {
    return (
      <EmptyState
        title="Jadwal belum dibuat"
        description="Buat jadwal otomatis dari tab Ringkasan, tambahkan pertandingan satu per satu, atau unggah jadwal dari berkas CSV."
        action={tools}
      />
    );
  }

  // group by (stage, round, groupLabel)
  const buckets = new Map<string, typeof matches>();
  for (const m of matches) {
    const key =
      m.stage === "league"
        ? `Pekan ${m.round}`
        : m.groupLabel
          ? `${STAGE_LABEL[m.stage] ?? m.stage} · Grup ${m.groupLabel} · Pekan ${m.round}`
          : `${STAGE_LABEL[m.stage] ?? m.stage}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">{matches.length} pertandingan</p>
        {tools}
      </div>
      {[...buckets.entries()].map(([label, list]) => (
        <Card key={label}>
          <CardContent>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              {label}
            </h3>
            <div className="space-y-2">
              {list.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <MatchRow m={m} showMeta={false} />
                  </div>
                  {canManage && m.status === "scheduled" && (
                    <DeleteMatchButton matchId={m.id} label={`${m.homeShort ?? "?"} vs ${m.awayShort ?? "?"}`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
