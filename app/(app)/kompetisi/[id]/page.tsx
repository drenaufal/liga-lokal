import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Radio, CalendarDays, Users2, Layers, Trophy, MapPin } from "lucide-react";
import { getCompetitionOverview } from "@/lib/queries/competition";
import { requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Progress } from "@/components/ui/misc";
import { MatchRow, MatchStack } from "@/components/app/match-row";
import { StatusBadge } from "@/components/app/status-badge";
import { formatLabel, categoryLabel } from "@/lib/ku";
import { cn } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CompetitionOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireViewerCapability("competition:view");
  const { id } = await params;
  const d = await getCompetitionOverview(id);
  if (!d) notFound();
  const { kus, totals, recentResults, upcoming } = d;
  const canManage = can(user, "ku:create");

  // On a phone the age groups come first — picking one is why people open this page;
  // the totals sit above them on a wide screen, where there is room for both.
  return (
    <div className="flex flex-col gap-4">
      <div className="order-2 grid grid-cols-2 gap-3 lg:order-1 lg:grid-cols-4">
        <StatCard label={t("KU")} value={totals.kus} block="red" />
        <StatCard label={t("SSB Peserta")} value={totals.clubs} block="blue" hint={t("di semua KU")} />
        <StatCard
          label={t("Pertandingan")}
          block="yellow"
          value={totals.matches}
          hint={t("{done} selesai · {goals} gol", { done: totals.completed, goals: totals.goals })}
        />
        <StatCard
          label={t("Sedang Berlangsung")}
          block="night"
          value={totals.live}
          tone={totals.live > 0 ? "danger" : "default"}
        />
      </div>

      <section className="order-1 space-y-3 lg:order-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">{t("KU dalam turnamen ini")}</h2>
          {kus.length > 0 && <span className="text-[11px] text-ink-muted">{t("Pilih KU untuk melihat jadwal, klasemen, dan peserta")}</span>}
        </div>

        {kus.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={t("Belum ada KU")}
            description={t("Tambahkan KU pertama — pilih kategori usia, format Liga atau Cup, tanggal mulai, dan SSB pesertanya.")}
            action={
              canManage ? (
                <Button size="sm" href={`/kompetisi/${id}/ku/baru`}>
                  <Plus className="size-3.5" /> {t("Tambah KU")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {/* archived KUs sink to the end; the sort is stable, so the rest keep their age order */}
            {[...kus].sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived")).map((k) => {
              const progress = k.totalMatches > 0 ? (k.playedMatches / k.totalMatches) * 100 : 0;
              const base = `/kompetisi/ku/${k.id}`;
              return (
                <div
                  key={k.id}
                  className={cn(
                    "group relative flex flex-col rounded-xl border border-line bg-surface/70 p-4 transition-colors focus-within:border-brand/40 hover:border-brand/40",
                    k.status === "archived" && "opacity-70",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {/* The whole card opens the KU: this link stretches over it, the shortcuts below sit above it. */}
                        <Link
                          href={base}
                          className="font-display text-3xl leading-none tracking-wide text-ink outline-none after:absolute after:inset-0 after:rounded-xl group-hover:text-brand"
                        >
                          {k.ageCode ?? "—"}
                        </Link>
                        {k.liveMatches > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-danger">
                            <Radio className="size-3 animate-live" /> {t("{n} LANGSUNG", { n: k.liveMatches })}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">{k.ageLabel ? categoryLabel(t, k.ageLabel) : t("Tanpa kategori usia")}</p>
                    </div>
                    <StatusBadge kind="tournament" value={k.status} dot />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                    <Badge tone={k.format === "cup" ? "violet" : "info"} className="!py-0">
                      {t.dyn(formatLabel(k.format))}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Users2 className="size-3" /> {t("{n} SSB", { n: k.teams })}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {k.startDate ? fmt.date(k.startDate) : t("Belum dijadwalkan")}
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
                        <span>{t("Progres pertandingan")}</span>
                        <span className="tabular-nums">
                          {k.playedMatches} / {k.totalMatches}
                        </span>
                      </div>
                      <Progress value={progress} tone={progress === 100 ? "success" : "brand"} />
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-ink-muted">{t("Jadwal belum dibuat")}</p>
                  )}

                  <div className="relative z-10 mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line-soft pt-3 text-[11px] font-semibold">
                    <Link href={`${base}/jadwal`} className="text-brand hover:underline">
                      {t("Jadwal & Hasil")}
                    </Link>
                    {/* A league has standings, a cup a bracket. */}
                    <Link
                      href={`${base}/${k.format === "cup" ? "bagan" : "klasemen"}`}
                      className="text-ink-secondary hover:text-ink hover:underline"
                    >
                      {k.format === "cup" ? t("Bagan Cup") : t("Klasemen")}
                    </Link>
                    <Link href={`${base}/peserta`} className="text-ink-secondary hover:text-ink hover:underline">
                      {t("Peserta")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(recentResults.length > 0 || upcoming.length > 0) && (
        <div className="order-3 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-4" /> {t("Hasil Terakhir")}
              </CardTitle>
              <Link href={`/kompetisi/${id}/jadwal`} className="text-[11px] text-ink-muted hover:text-ink">
                {t("Semua jadwal")}
              </Link>
            </CardHeader>
            <CardContent>
              {recentResults.length ? (
                <MatchStack>
                  {recentResults.map((m) => (
                    <MatchRow key={m.id} m={m} />
                  ))}
                </MatchStack>
              ) : (
                <p className="py-6 text-center text-xs text-ink-muted">{t("Belum ada hasil dikonfirmasi.")}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Jadwal Mendatang")}</CardTitle>
              <Link href={`/kompetisi/${id}/jadwal?status=upcoming`} className="text-[11px] text-ink-muted hover:text-ink">
                {t("Semua jadwal")}
              </Link>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <MatchStack>
                  {upcoming.map((m) => (
                    <MatchRow key={m.id} m={m} />
                  ))}
                </MatchStack>
              ) : (
                <p className="py-6 text-center text-xs text-ink-muted">{t("Tidak ada pertandingan terjadwal.")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
