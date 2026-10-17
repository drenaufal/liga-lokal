import { getTournamentBase, getTournamentStandings } from "@/lib/queries/competition";
import { Card, CardContent } from "@/components/ui/card";
import { StandingsTable } from "@/components/app/standings-table";
import { EmptyState } from "@/components/ui/misc";
import { TIEBREAKER_LABEL } from "@/lib/standings";
import { RecomputeStandingsButton } from "../fixture-actions";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCapability("competition:view");
  const { id } = await params;
  const [t, rows] = await Promise.all([
    getTournamentBase(id),
    getTournamentStandings(id),
  ]);
  const canManage = can(user, "ku:fixtures");

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Klasemen belum tersedia"
        description="Klasemen dihitung otomatis dari hasil pertandingan yang telah dikonfirmasi."
        action={canManage ? <RecomputeStandingsButton tournamentId={id} /> : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <StandingsTable rows={rows} advancePerGroup={t?.advancePerGroup ?? 0} />
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-ink-muted">
          Urutan tie-breaker:{" "}
          {(t?.tiebreakers ?? []).map((tb) => TIEBREAKER_LABEL[tb]).join(" → ")}
        </p>
        {canManage && <RecomputeStandingsButton tournamentId={id} />}
      </div>
    </div>
  );
}
