import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentOverview } from "@/lib/queries/competition";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/app/page-header";
import { BarList } from "@/components/charts/bar-list";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState } from "@/components/ui/misc";
import { GenerateFixturesButton, RecomputeStandingsButton } from "./fixture-actions";
import { crestTint } from "@/lib/crest";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function TournamentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getTournamentOverview(id);
  if (!d) notFound();
  const { tournament: t, teams, matchAgg, topScorers, recentResults, upcoming } = d;
  const user = await getCurrentUser();
  const canManage = can(user?.role, "competition:write");
  const hasFixtures = Number(matchAgg.total) > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="SSB Peserta" value={teams.length} block="red" />
        <StatCard
          label="Pertandingan"
          block="blue"
          value={Number(matchAgg.total)}
          hint={`${Number(matchAgg.completed)} selesai`}
        />
        <StatCard
          label="Total Gol"
          block="yellow"
          value={Number(matchAgg.goals)}
          hint={
            Number(matchAgg.completed) > 0
              ? `${(Number(matchAgg.goals) / Number(matchAgg.completed)).toFixed(1)} / laga`
              : "—"
          }
        />
        <StatCard
          label="Sedang Berlangsung"
          block="night"
          value={Number(matchAgg.live)}
          tone={Number(matchAgg.live) > 0 ? "danger" : "default"}
        />
      </div>

      {canManage && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-ink-muted">Aksi operator:</span>
            {!hasFixtures && <GenerateFixturesButton tournamentId={id} />}
            {(t.format === "league" || t.groupCount > 0) && <RecomputeStandingsButton tournamentId={id} />}
            {hasFixtures ? (
              <span className="text-[11px] text-ink-muted">
                Jadwal sudah dibuat — {Number(matchAgg.total)} pertandingan. Tambah pertandingan manual atau unggah CSV
                dari tab Jadwal & Hasil.
              </span>
            ) : (
              <span className="text-[11px] text-ink-muted">
                Atau susun jadwal sendiri di tab Jadwal & Hasil — satu per satu atau lewat unggah CSV.
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Hasil Terakhir</CardTitle>
              <Link
                href={`/kompetisi/ku/${id}/jadwal`}
                className="text-[11px] text-ink-muted hover:text-ink"
              >
                Semua jadwal
              </Link>
            </CardHeader>
            <CardContent>
              {recentResults.length ? (
                <div className="space-y-2">
                  {recentResults.map((m) => (
                    <MatchRow key={m.id} m={m} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Belum ada hasil"
                  description="Hasil pertandingan akan muncul di sini setelah dikonfirmasi."
                />
              )}
            </CardContent>
          </Card>

          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Jadwal Mendatang</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcoming.map((m) => (
                    <MatchRow key={m.id} m={m} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pencetak Gol</CardTitle>
            </CardHeader>
            <CardContent>
              {topScorers.length ? (
                <BarList
                  accent="var(--color-chart-1)"
                  items={topScorers.map((p) => ({
                    label: p.name,
                    sublabel: `${p.club ?? "—"} · ${p.assists}A`,
                    value: p.goals ?? 0,
                    href: `/registry/pemain/${p.id}`,
                  }))}
                />
              ) : (
                <p className="py-6 text-center text-xs text-ink-muted">Belum ada gol tercatat.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peserta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {teams.map((tm) => (
                  <Link
                    key={tm.id}
                    href={`/registry/klub/${tm.clubId}`}
                    className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[11px] text-ink-secondary transition-colors hover:border-brand/40"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: crestTint(tm.short).bg }}
                    />
                    {tm.short}
                    {tm.group && (
                      <span className="text-ink-muted">· {tm.group}</span>
                    )}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
