import { FileSpreadsheet } from "lucide-react";
import { getTournamentBase, getTournamentStandings } from "@/lib/queries/competition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StandingsTable } from "@/components/app/standings-table";
import { EmptyState } from "@/components/ui/misc";
import { TIEBREAKER_LABEL } from "@/lib/standings";
import { RecomputeStandingsButton } from "../fixture-actions";
import { isGuest, requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = await getI18n();
  const user = await requireViewerCapability("competition:view");
  const { id } = await params;
  const [tour, rows] = await Promise.all([
    getTournamentBase(id),
    getTournamentStandings(id),
  ]);
  const canManage = can(user, "ku:fixtures");
  const canDownload = !(await isGuest()); // the Excel route needs an account

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("Klasemen belum tersedia")}
        description={t("Klasemen dihitung otomatis dari hasil pertandingan yang telah dikonfirmasi.")}
        action={canManage ? <RecomputeStandingsButton tournamentId={id} /> : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <StandingsTable rows={rows} advancePerGroup={tour?.advancePerGroup ?? 0} />
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-ink-muted">
          {t("Urutan tie-breaker:")}{" "}
          {(tour?.tiebreakers ?? []).map((tb) => t(TIEBREAKER_LABEL[tb])).join(" → ")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canDownload && (
            <Button asChild size="sm" variant="outline">
              <a href={`/kompetisi/ku/${id}/klasemen/unduh`} download>
                <FileSpreadsheet /> {t("Unduh Excel")}
              </a>
            </Button>
          )}
          {canManage && <RecomputeStandingsButton tournamentId={id} />}
        </div>
      </div>
    </div>
  );
}
