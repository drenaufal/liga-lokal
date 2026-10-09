import { getTournamentFixtures, getTournamentTeamShorts } from "@/lib/queries/competition";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState } from "@/components/ui/misc";
import { STAGE_LABEL } from "@/lib/status";
import { ScheduleUpload } from "../schedule-upload";

export const dynamic = "force-dynamic";

export default async function FixturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canManage = can(user?.role, "competition:write");
  const [matches, shorts] = await Promise.all([
    getTournamentFixtures(id),
    canManage ? getTournamentTeamShorts(id) : Promise.resolve([] as string[]),
  ]);
  // The upload lives here, inside the tournament, and nowhere else.
  const upload = canManage ? <ScheduleUpload tournamentId={id} shorts={shorts} /> : null;

  if (matches.length === 0) {
    return (
      <EmptyState
        title="Jadwal belum dibuat"
        description="Buat jadwal otomatis dari tab Ringkasan, atau unggah jadwal Anda sendiri dari berkas CSV."
        action={upload}
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
        {upload}
      </div>
      {[...buckets.entries()].map(([label, list]) => (
        <Card key={label}>
          <CardContent>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              {label}
            </h3>
            <div className="space-y-2">
              {list.map((m) => (
                <MatchRow key={m.id} m={m} showMeta={false} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
