import { getPlayerRadarData, getPeerPool, searchPlayersForRadar, getPlayerFilterOptions } from "@/lib/queries/intelligence";
import { getClubScope } from "@/lib/auth/session";
import { requireViewerCapability } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Radar } from "@/components/charts/radar";
import { RADAR_AXES, radarValues, per90Summary } from "@/lib/player-metrics";
import { LINE_LABEL, positionLine, positionText } from "@/lib/positions";
import { PlayerPicker } from "./player-picker";
import { IntelligenceFilters, IntelligencePagination } from "./filters";
import { playerFilterFields, paramValue, type IntelligenceParams } from "@/lib/intelligence-filters";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<IntelligenceParams>;
}) {
  const { t } = await getI18n();
  await requireViewerCapability("intelligence.radar:view");
  const sp = await searchParams;
  const scope = await getClubScope();
  const [results, filterOptions] = await Promise.all([searchPlayersForRadar(sp, scope), getPlayerFilterOptions(scope)]);
  const list = results.rows;
  const selectedId = paramValue(sp, "player") || list[0]?.id;
  const [rows] = await Promise.all([
    selectedId ? getPlayerRadarData([selectedId], scope) : Promise.resolve([]),
  ]);
  const row = rows[0];

  let peers: Awaited<ReturnType<typeof getPeerPool>> = [];
  if (row) peers = await getPeerPool(row.position, row.ageCategoryId);

  const radar = row ? radarValues(row.stat) : null;
  const p90 = row ? per90Summary(row.stat) : null;

  // A bar is the player's per-90 figure against the best figure among the same peers.
  const share = (v: number, pool: number[]) => {
    const best = Math.max(0, ...pool);
    return best > 0 ? Math.min(100, Math.round((v / best) * 100)) : 0;
  };

  return (
    <div className="space-y-4">
      <IntelligenceFilters params={sp} fields={playerFilterFields(filterOptions, t)} title={t("Filter pemain & radar")} />
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("Pilih Pemain")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PlayerPicker players={list} selectedId={selectedId} />
          <IntelligencePagination params={sp} total={results.total} page={results.page} pageSize={results.pageSize} label={t("pemain")} />
        </CardContent>
      </Card>

      {row && radar && p90 ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar src={row.photoUrl} name={row.name} size={64} square className="border border-line" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">{row.name}</h2>
                  <Badge tone="info">{positionText(row.position, t)}</Badge>
                  {row.ageCode && <Badge>{row.ageCode}</Badge>}
                  <span className="text-xs text-ink-muted">{row.club}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
                  <span>{t("{n} penampilan", { n: row.stat.appearances })}</span>
                  <span>{t("{goals} gol · {assists} assist", { goals: row.stat.goals, assists: row.stat.assists })}</span>
                  <span>{t("Rating {value}", { value: row.stat.rating.toFixed(1) })}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold tabular-nums text-brand">
                  {Math.round(row.stat.score)}
                </div>
                <div className="text-[10px] text-ink-muted">{t("Skor performa")}</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("Radar Performa")}</CardTitle>
                <span className="text-[11px] text-ink-muted">{t("Total statistik pertandingan")}</span>
              </CardHeader>
              <CardContent>
                <Radar
                  axes={RADAR_AXES.map((a) => ({ key: a.key, label: t(a.label) }))}
                  series={[{ label: row.name, color: "var(--color-chart-1)", values: radar }]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("Statistik per 90 Menit")}</CardTitle>
                <span className="text-[11px] text-ink-muted">
                  {t("Dibanding {n} pemain {line} {age}", { n: peers.length, line: t.dyn(LINE_LABEL[positionLine(row.position)]), age: row.ageCode ?? "" })}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  [t("Gol / 90"), p90.goals, peers.map((x) => (x.minutesPlayed ? (x.goals / x.minutesPlayed) * 90 : 0))],
                  [t("Assist / 90"), p90.assists, peers.map((x) => (x.minutesPlayed ? (x.assists / x.minutesPlayed) * 90 : 0))],
                  [t("Umpan kunci / 90"), p90.keyPasses, peers.map((x) => (x.minutesPlayed ? (x.keyPasses / x.minutesPlayed) * 90 : 0))],
                  [t("Tekel / 90"), p90.tackles, peers.map((x) => (x.minutesPlayed ? (x.tackles / x.minutesPlayed) * 90 : 0))],
                  [t("Penyelamatan / 90"), p90.saves, peers.map((x) => (x.minutesPlayed ? (x.saves / x.minutesPlayed) * 90 : 0))],
                ].map(([label, value, pool]) => {
                  const fill = share(value as number, pool as number[]);
                  return (
                    <div key={label as string}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-ink-secondary">{label}</span>
                        <span className="tabular-nums text-ink">{(value as number).toFixed(2)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${fill}%`,
                            background:
                              fill >= 75
                                ? "var(--color-success)"
                                : fill >= 40
                                  ? "var(--color-info)"
                                  : "var(--color-warn)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-sm text-ink-muted">
            {t("Pilih pemain di panel kiri untuk melihat profil radar.")}
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
