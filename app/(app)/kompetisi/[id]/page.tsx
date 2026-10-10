import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Radio, CalendarDays, Users2, Layers, Trophy, MapPin } from "lucide-react";
import { getCompetitionOverview } from "@/lib/queries/competition";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Progress } from "@/components/ui/misc";
import { MatchRow } from "@/components/app/match-row";
import { StatusBadge } from "@/components/app/status-badge";
import { formatLabel } from "@/lib/ku";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompetitionOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getCompetitionOverview(id);
  if (!d) notFound();
  const { kus, totals, recentResults, upcoming } = d;
  const user = await getCurrentUser();
  const canManage = can(user?.role, "competition:write");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="KU" value={totals.kus} block="red" />
        <StatCard label="SSB Peserta" value={totals.clubs} block="blue" hint="di semua KU" />
        <StatCard
          label="Pertandingan"
          block="yellow"
          value={totals.matches}
          hint={`${totals.completed} selesai · ${totals.goals} gol`}
        />
        <StatCard
          label="Sedang Berlangsung"
          block="night"
          value={totals.live}
          tone={totals.live > 0 ? "danger" : "default"}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">KU dalam turnamen ini</h2>
        {canManage && kus.length > 0 && (
          <Button size="sm" variant="outline" href={`/kompetisi/${id}/ku/baru`}>
            <Plus className="size-3.5" /> Tambah KU
          </Button>
        )}
      </div>

      {kus.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Belum ada KU"
          description="Tambahkan KU pertama — pilih kategori usia, format Liga atau Cup, tanggal mulai, dan SSB pesertanya."
          action={
            canManage ? (
              <Button size="sm" href={`/kompetisi/${id}/ku/baru`}>
                <Plus className="size-3.5" /> Tambah KU
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {kus.map((k) => {
            const progress = k.totalMatches > 0 ? (k.playedMatches / k.totalMatches) * 100 : 0;
            return (
              <Link
                key={k.id}
                href={`/kompetisi/ku/${k.id}`}
                className="group rounded-xl border border-line bg-surface/70 p-4 transition-colors hover:border-brand/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-3xl leading-none tracking-wide text-ink group-hover:text-brand">
                        {k.ageCode ?? "—"}
                      </span>
                      {k.liveMatches > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-danger">
                          <Radio className="size-3 animate-live" /> {k.liveMatches} LANGSUNG
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{k.ageLabel ?? "Tanpa kategori usia"}</p>
                  </div>
                  <StatusBadge kind="tournament" value={k.status} dot />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                  <Badge tone={k.format === "cup" ? "violet" : "info"} className="!py-0">
                    {formatLabel(k.format)}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Users2 className="size-3" /> {k.teams} SSB
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {k.startDate ? formatDate(k.startDate) : "Belum dijadwalkan"}
                  </span>
                  {k.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" /> {k.city}
                    </span>
                  )}
                </div>

                {k.totalMatches > 0 ? (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[10px] text-ink-muted">
                      <span>Progres pertandingan</span>
                      <span className="tabular-nums">
                        {k.playedMatches} / {k.totalMatches}
                      </span>
                    </div>
                    <Progress value={progress} tone={progress === 100 ? "success" : "brand"} />
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-ink-muted">Jadwal belum dibuat</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {(recentResults.length > 0 || upcoming.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-4" /> Hasil Terakhir
              </CardTitle>
              <Link href={`/kompetisi/${id}/jadwal`} className="text-[11px] text-ink-muted hover:text-ink">
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
                <p className="py-6 text-center text-xs text-ink-muted">Belum ada hasil dikonfirmasi.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Jadwal Mendatang</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <div className="space-y-2">
                  {upcoming.map((m) => (
                    <MatchRow key={m.id} m={m} />
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-ink-muted">Tidak ada pertandingan terjadwal.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
