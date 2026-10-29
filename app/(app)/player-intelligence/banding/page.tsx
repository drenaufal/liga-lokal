import Link from "next/link";
import { X } from "lucide-react";
import { getPlayerRadarData, searchPlayersForRadar, getPlayerFilterOptions } from "@/lib/queries/intelligence";
import { getClubScope } from "@/lib/auth/session";
import { requireViewerCapability } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Radar } from "@/components/charts/radar";
import { RADAR_AXES, radarValues } from "@/lib/player-metrics";
import { positionText } from "@/lib/positions";
import { IntelligenceFilters, IntelligencePagination } from "../filters";
import { playerFilterFields, paramValue, queryHref, type IntelligenceParams } from "@/lib/intelligence-filters";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const SERIES_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<IntelligenceParams>;
}) {
  const { t } = await getI18n();
  await requireViewerCapability("intelligence.compare:view");
  const sp = await searchParams;
  const selected = [...new Set(paramValue(sp, "players").split(",").filter(Boolean))].slice(0, 3);
  const scope = await getClubScope();
  const [results, rows, filterOptions] = await Promise.all([
    searchPlayersForRadar(sp, scope),
    selected.length ? getPlayerRadarData(selected, scope) : Promise.resolve([]),
    getPlayerFilterOptions(scope),
  ]);
  const ordered = selected.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as typeof rows;

  const selectionHref = (ids: string[]) => queryHref(sp, { players: ids.join(",") });
  const addHref = (id: string) => selectionHref([...selected, ...(selected.length < 3 ? [id] : [])]);
  const removeHref = (id: string) => selectionHref(selected.filter((s) => s !== id));

  return (
    <div className="space-y-4">
      <IntelligenceFilters params={sp} fields={playerFilterFields(filterOptions, t)} title={t("Filter & urutkan kandidat perbandingan")} />
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("Tambah Pemain ({n}/3)", { n: selected.length })}</CardTitle>
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
                          {p.club} · {positionText(p.position, t)} · {p.ageCode}
                        </span>
                      </span>
                      {isSelected ? (
                        <X className="size-3.5 text-danger" />
                      ) : selected.length < 3 ? (
                        <span className="text-[10px] text-brand">{t("+ Tambah")}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {!results.total && <p className="px-3 py-6 text-center text-xs text-ink-muted">{t("Tidak ada pemain yang cocok. Sesuaikan atau reset filter.")}</p>}
          </div>
          <IntelligencePagination params={sp} total={results.total} page={results.page} pageSize={results.pageSize} label={t("pemain")} />
        </CardContent>
      </Card>

      {ordered.length >= 1 ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("Radar Perbandingan")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Radar
                axes={RADAR_AXES.map((a) => ({ key: a.key, label: t(a.label) }))}
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
              <CardTitle>{t("Perbandingan Head-to-Head")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-2.5">{t("Metrik")}</th>
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
                    {/* the same eight metrics as the radar above */}
                    {RADAR_AXES.map(({ key, label }) => {
                      const vals = ordered.map((r) => r.stat[key] ?? 0);
                      const max = Math.max(...vals);
                      return (
                        <tr key={key}>
                          <td className="px-4 py-2.5 text-ink-secondary">{t(label)}</td>
                          {ordered.map((r, i) => (
                            <td
                              key={r.id}
                              className={`px-3 py-2.5 text-right tabular-nums ${
                                vals[i] === max && max > 0 ? "font-semibold text-brand" : "text-ink"
                              }`}
                            >
                              {vals[i]}
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
            {t("Pilih 2–3 pemain dari panel kiri untuk membandingkan profil performa.")}
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
