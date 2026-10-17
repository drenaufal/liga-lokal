import Link from "next/link";
import { X } from "lucide-react";
import { getPlayerRadarData, searchPlayersForRadar, getPlayerFilterOptions } from "@/lib/queries/intelligence";
import { requireCapability } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Radar } from "@/components/charts/radar";
import { RADAR_AXES, radarValues } from "@/lib/player-metrics";
import { POSITION } from "@/lib/status";
import { IntelligenceFilters, IntelligencePagination } from "../filters";
import { playerFilterFields, paramValue, queryHref, type IntelligenceParams } from "@/lib/intelligence-filters";

export const dynamic = "force-dynamic";

const SERIES_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<IntelligenceParams>;
}) {
  await requireCapability("intelligence.compare:view");
  const sp = await searchParams;
  const selected = [...new Set(paramValue(sp, "players").split(",").filter(Boolean))].slice(0, 3);
  const [results, rows, filterOptions] = await Promise.all([
    searchPlayersForRadar(sp),
    selected.length ? getPlayerRadarData(selected) : Promise.resolve([]),
    getPlayerFilterOptions(),
  ]);
  const ordered = selected.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as typeof rows;

  const selectionHref = (ids: string[]) => queryHref(sp, { players: ids.join(",") });
  const addHref = (id: string) => selectionHref([...selected, ...(selected.length < 3 ? [id] : [])]);
  const removeHref = (id: string) => selectionHref(selected.filter((s) => s !== id));

  const metricRows = [
    ["Penampilan", (s: (typeof rows)[number]["stat"]) => s.appearances],
    ["Gol", (s: (typeof rows)[number]["stat"]) => s.goals],
    ["Assist", (s: (typeof rows)[number]["stat"]) => s.assists],
    ["Shot on goal", (s: (typeof rows)[number]["stat"]) => s.shotsOnTarget],
    ["Shot off target", (s: (typeof rows)[number]["stat"]) => s.shotsOffTarget],
    ["Red card", (s: (typeof rows)[number]["stat"]) => s.redCards],
    ["Tekel", (s: (typeof rows)[number]["stat"]) => s.tackles],
    ["Intersep", (s: (typeof rows)[number]["stat"]) => s.interceptions],
    ["Penyelamatan", (s: (typeof rows)[number]["stat"]) => s.saves],
    ["Nirbobol", (s: (typeof rows)[number]["stat"]) => s.cleanSheets],
    ["Kartu kuning", (s: (typeof rows)[number]["stat"]) => s.yellowCards],
    ["Rating rata-rata", (s: (typeof rows)[number]["stat"]) => s.rating.toFixed(1)],
    ["Skor performa", (s: (typeof rows)[number]["stat"]) => Math.round(s.score)],
  ] as const;

  return (
    <div className="space-y-4">
      <IntelligenceFilters params={sp} fields={playerFilterFields(filterOptions)} title="Filter & urutkan kandidat perbandingan" />
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Tambah Pemain ({selected.length}/3)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-1.5">
            <ul>
              {results.rows.map((p) => {
                const isSelected = selected.includes(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={isSelected ? removeHref(p.id) : addHref(p.id)}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        isSelected ? "bg-brand/10" : "hover:bg-surface-2"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink">{p.name}</span>
                        <span className="block truncate text-[10px] text-ink-muted">
                          {p.club} · {POSITION[p.position].label} · {p.ageCode}
                        </span>
                      </span>
                      {isSelected ? (
                        <X className="size-3.5 text-danger" />
                      ) : selected.length < 3 ? (
                        <span className="text-[10px] text-brand">+ Tambah</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {!results.total && <p className="px-3 py-6 text-center text-xs text-ink-muted">Tidak ada pemain yang cocok. Sesuaikan atau reset filter.</p>}
          </div>
          <IntelligencePagination params={sp} total={results.total} page={results.page} pageSize={results.pageSize} label="pemain" />
        </CardContent>
      </Card>

      {ordered.length >= 1 ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Radar Perbandingan</CardTitle>
            </CardHeader>
            <CardContent>
              <Radar
                axes={RADAR_AXES.map((a) => ({ key: a.key, label: a.label }))}
                series={ordered.map((r, i) => ({
                  label: r.name,
                  color: SERIES_COLORS[i],
                  values: radarValues(r.stat),
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Perbandingan Head-to-Head</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-2.5">Metrik</th>
                      {ordered.map((r, i) => (
                        <th key={r.id} className="px-3 py-2.5 text-right">
                          <span className="flex items-center justify-end gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: SERIES_COLORS[i] }}
                            />
                            {r.name.split(" ").slice(-1)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {metricRows.map(([label, fn]) => {
                      const vals = ordered.map((r) => Number(fn(r.stat)));
                      const max = Math.max(...vals);
                      return (
                        <tr key={label}>
                          <td className="px-4 py-2.5 text-ink-secondary">{label}</td>
                          {ordered.map((r, i) => (
                            <td
                              key={r.id}
                              className={`px-3 py-2.5 text-right tabular-nums ${
                                vals[i] === max && max > 0 ? "font-semibold text-brand" : "text-ink"
                              }`}
                            >
                              {String(fn(r.stat))}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-sm text-ink-muted">
            Pilih 2–3 pemain dari panel kiri untuk membandingkan profil performa.
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
