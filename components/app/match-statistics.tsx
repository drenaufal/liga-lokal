import { CircleDot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MATCH_EVENT_STYLE } from "./match-event-style";
import { cn } from "@/lib/utils";
import type { MatchStatistic } from "@/lib/match-statistics";
import { getT } from "@/lib/i18n/server";

export async function MatchStatistics({ stats, possession, homeShort, awayShort }: {
  stats: MatchStatistic[];
  /** Ball possession in % (from passes); `null` while no pass is recorded. */
  possession: { home: number; away: number } | null;
  homeShort: string | null;
  awayShort: string | null;
}) {
  const t = await getT();
  return (
    <Card>
      <CardHeader><CardTitle>{t("Statistik Pertandingan")}</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3 text-[10px] font-semibold text-ink-secondary">
          <span className="flex min-w-0 items-center gap-1.5"><span className="size-2 shrink-0 rounded-full bg-brand" /><span className="truncate">{homeShort ?? t("Tuan rumah")}</span></span>
          <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{awayShort ?? t("Tamu")}</span><span className="size-2 shrink-0 rounded-full bg-block-blue" /></span>
        </div>
        <dl className="space-y-3">
          {/* Possession leads: it is the one share rather than a count */}
          <div className="rounded-xl bg-surface-2/70 p-3">
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center gap-2">
              <dt className="col-start-2 row-start-1 mx-auto inline-flex max-w-full items-center gap-1.5 rounded-lg bg-night px-2.5 py-1.5 text-[10px] font-semibold text-white">
                <CircleDot className="size-3.5 shrink-0" /><span>{t("Penguasaan bola")}</span>
              </dt>
              <dd className="col-start-1 row-start-1 font-display text-xl tabular-nums">
                <span className="sr-only">{homeShort ?? t("Tuan rumah")}: </span>{possession ? `${possession.home}%` : "–"}
              </dd>
              <dd className="col-start-3 row-start-1 text-right font-display text-xl tabular-nums">
                <span className="sr-only">{awayShort ?? t("Tamu")}: </span>{possession ? `${possession.away}%` : "–"}
              </dd>
            </div>
            <div aria-hidden="true" className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-elevated">
              {possession && <>
                <span className="bg-brand" style={{ width: `${possession.home}%` }} />
                <span className="ml-auto bg-block-blue" style={{ width: `${possession.away}%` }} />
              </>}
            </div>
            <p className="mt-1.5 text-center text-[10px] text-ink-muted">
              {possession ? t("Dihitung dari jumlah passing: passing klub ÷ passing kedua klub × 100%.") : t("Muncul setelah passing dicatat.")}
            </p>
          </div>
          {stats.map(({ label, type, home, away }) => {
            const style = MATCH_EVENT_STYLE[type];
            const Icon = style.icon;
            const total = home + away || 1;
            return (
              <div key={label}>
                <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
                  <dt className={cn("col-start-2 row-start-1 mx-auto inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold", style.tile)}><Icon className="size-3.5 shrink-0" /><span>{t.dyn(label)}</span></dt>
                  <dd className="col-start-1 row-start-1 font-display text-xl tabular-nums"><span className="sr-only">{homeShort ?? t("Tuan rumah")}: </span>{home}</dd>
                  <dd className="col-start-3 row-start-1 text-right font-display text-xl tabular-nums"><span className="sr-only">{awayShort ?? t("Tamu")}: </span>{away}</dd>
                </div>
                <div aria-hidden="true" className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-elevated">
                  <span className="bg-brand" style={{ width: `${(home / total) * 100}%` }} />
                  <span className="ml-auto bg-block-blue" style={{ width: `${(away / total) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
