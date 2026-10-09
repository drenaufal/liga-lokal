import { getPlayerRadarData, getPeerPool, searchPlayersForRadar } from "@/lib/queries/intelligence";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Radar } from "@/components/charts/radar";
import { RADAR_AXES, radarValues, per90Summary, percentileOf } from "@/lib/player-metrics";
import { POSITION } from "@/lib/status";
import { LINE_LABEL, positionLine } from "@/lib/positions";
import { PlayerPicker } from "./player-picker";

export const dynamic = "force-dynamic";

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string; q?: string; position?: string; age?: string }>;
}) {
  const sp = await searchParams;
  const list = await searchPlayersForRadar(sp.q, sp.position, sp.age);
  const selectedId = sp.player ?? list[0]?.id;
  const [rows] = await Promise.all([
    selectedId ? getPlayerRadarData([selectedId]) : Promise.resolve([]),
  ]);
  const row = rows[0];

  let peers: Awaited<ReturnType<typeof getPeerPool>> = [];
  if (row) peers = await getPeerPool(row.position, row.ageCategoryId);

  const radar = row ? radarValues(row.stat) : null;
  const p90 = row ? per90Summary(row.stat) : null;

  const pct = (v: number, pool: number[]) => percentileOf(v, pool);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Pilih Pemain</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PlayerPicker players={list} selectedId={selectedId} />
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
                  <Badge tone="info">{POSITION[row.position].label}</Badge>
                  {row.ageCode && <Badge>{row.ageCode}</Badge>}
                  <span className="text-xs text-ink-muted">{row.club}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
                  <span>{row.stat.appearances} penampilan</span>
                  <span>{row.stat.goals} gol · {row.stat.assists} assist</span>
                  <span>Rating {row.stat.rating.toFixed(1)}</span>
                  <span className="text-brand">Skor {Math.round(row.stat.score)}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold tabular-nums text-brand">
                  {pct(row.stat.score, peers.map((x) => x.score)) ?? "—"}
                </div>
                <div className="text-[10px] text-ink-muted">
                  Persentil<br />
                  {LINE_LABEL[positionLine(row.position)]} {row.ageCode}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Radar Performa</CardTitle>
                <span className="text-[11px] text-ink-muted">skala per-90 vs batas referensi</span>
              </CardHeader>
              <CardContent>
                <Radar
                  axes={RADAR_AXES.map((a) => ({ key: a.key, label: a.label }))}
                  series={[{ label: row.name, color: "var(--color-chart-1)", values: radar }]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Persentil vs Rekan Seposisi</CardTitle>
                <span className="text-[11px] text-ink-muted">
                  {peers.length} pemain {LINE_LABEL[positionLine(row.position)]} {row.ageCode}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ["Gol / 90", p90.goals, peers.map((x) => (x.minutesPlayed ? (x.goals / x.minutesPlayed) * 90 : 0))],
                  ["Assist / 90", p90.assists, peers.map((x) => (x.minutesPlayed ? (x.assists / x.minutesPlayed) * 90 : 0))],
                  ["Umpan kunci / 90", p90.keyPasses, peers.map((x) => (x.minutesPlayed ? (x.keyPasses / x.minutesPlayed) * 90 : 0))],
                  ["Tekel / 90", p90.tackles, peers.map((x) => (x.minutesPlayed ? (x.tackles / x.minutesPlayed) * 90 : 0))],
                  ["Penyelamatan / 90", p90.saves, peers.map((x) => (x.minutesPlayed ? (x.saves / x.minutesPlayed) * 90 : 0))],
                ].map(([label, value, pool]) => {
                  const percentile = pct(value as number, pool as number[]) ?? 50;
                  return (
                    <div key={label as string}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-ink-secondary">{label}</span>
                        <span className="tabular-nums text-ink">
                          {(value as number).toFixed(2)}{" "}
                          <span className="text-ink-muted">· p{percentile}</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percentile}%`,
                            background:
                              percentile >= 75
                                ? "var(--color-success)"
                                : percentile >= 40
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
            Pilih pemain di panel kiri untuk melihat profil radar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
