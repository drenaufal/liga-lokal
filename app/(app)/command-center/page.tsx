import type { Metadata } from "next";
import Link from "next/link";
import { Users, ShieldCheck, Trophy, Radio, ArrowUpRight, Activity } from "lucide-react";
import { getCommandCenterData } from "@/lib/queries/command-center";
import { requireCapability, getClubScope } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader, StatCard } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { BarList } from "@/components/charts/bar-list";
import { Gauge as GaugeChart } from "@/components/charts/gauge";
import { Donut } from "@/components/charts/donut";
import { LiveMatchCard } from "@/components/app/live-match-card";
import { ActivityFeed } from "@/components/app/activity-feed";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { StatusBadge } from "@/components/app/status-badge";
import { VERIFICATION, TOURNAMENT_STATUS } from "@/lib/status";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Command Center" };
export const dynamic = "force-dynamic";

const VERIF_COLORS: Record<string, string> = {
  verified: "var(--color-success)",
  pending: "var(--color-info)",
  flagged: "var(--color-warn)",
  rejected: "var(--color-danger)",
};

export default async function CommandCenterPage() {
  const { t, fmt } = await getI18n();
  const user = await requireCapability("dashboard:view");
  const canActivity = can(user, "dashboard:activity");
  const d = await getCommandCenterData(user.role, await getClubScope());
  const k = d.kpis;

  const leaderCard = (
    title: string,
    rows: { id: string; name: string; club: string | null; value: number | null; position: string }[],
    accent: string,
  ) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <BarList
            accent={accent}
            items={rows.map((r) => ({
              label: r.name,
              sublabel: r.club ?? "—",
              value: Math.round(r.value ?? 0),
              href: `/registry/pemain/${r.id}`,
            }))}
          />
        ) : (
          <p className="py-6 text-center text-xs text-ink-muted">{t("Belum ada data.")}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <AutoRefresh seconds={20} />
      <PageHeader
        title="Command Center"
        description={t("Pemantauan menyeluruh kondisi sistem, kompetisi, dan pertandingan secara real-time.")}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("Pemain Terdaftar")}
          value={fmt.number(k.players)}
          icon={<Users className="size-4" />}
          block="red"
          hint={t("{n} terverifikasi", { n: fmt.number(k.playersVerified) })}
        />
        <StatCard
          label={t("Klub Aktif")}
          value={fmt.number(k.clubs)}
          icon={<ShieldCheck className="size-4" />}
          block="blue"
          hint={t("{n} venue terdaftar", { n: k.venues })}
        />
        <StatCard
          label={t("Pertandingan")}
          value={fmt.number(k.matchesTotal)}
          icon={<Trophy className="size-4" />}
          block="yellow"
          hint={t("{done} selesai · {upcoming} akan datang", { done: k.matchesCompleted, upcoming: k.matchesUpcoming })}
        />
        <StatCard
          label={t("Pertandingan Langsung")}
          value={k.matchesLive}
          icon={<Radio className="size-4" />}
          block="night"
          tone={k.matchesLive > 0 ? "danger" : "default"}
          hint={t("{n} wasit berlisensi aktif", { n: k.refereesActive })}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Live monitor */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-4 text-danger" />
                Live Match Monitor
              </CardTitle>
              <Link
                href="/match-ops"
                className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink"
              >
                {t("Semua pertandingan")} <ArrowUpRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {d.liveMatches.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {d.liveMatches.map((m) => (
                    <LiveMatchCard key={m.id} m={m} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Radio}
                  title={t("Tidak ada pertandingan berlangsung")}
                  description={t("Konsol pertandingan langsung akan muncul di sini saat pertandingan dimulai.")}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Verification compliance */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Kepatuhan Verifikasi Data")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <GaugeChart
              value={k.compliance}
              label={t("Terverifikasi")}
              sublabel={t("{a} dari {b} pemain", { a: fmt.number(k.playersVerified), b: fmt.number(k.players) })}
            />
            <div className="w-full space-y-1.5">
              {d.verificationMix
                .sort((a, b) => b.n - a.n)
                .map((r) => (
                  <div
                    key={r.status}
                    className="flex items-center justify-between text-xs"
                  >
                    <StatusBadge kind="verification" value={r.status} dot />
                    <span className="font-medium tabular-nums text-ink">{r.n}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {leaderCard(t("Pencetak Gol Terbanyak"), d.leaderboards.topScorers, "var(--color-chart-1)")}
        {leaderCard(t("Assist Terbanyak"), d.leaderboards.topAssists, "var(--color-chart-3)")}
        {leaderCard(t("Penyelamatan Terbaik"), d.leaderboards.topSaves, "var(--color-chart-4)")}
        {leaderCard(t("Pemain Terbaik (Skor)"), d.leaderboards.topRated, "var(--color-chart-7)")}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Tournament status */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Status KU")}</CardTitle>
            <Link href="/kompetisi" className="text-[11px] text-ink-muted hover:text-ink">
              {t("Kelola")}
            </Link>
          </CardHeader>
          <CardContent>
            <Donut
              centerLabel="KU"
              centerValue={String(d.tournamentMix.reduce((a, r) => a + r.n, 0))}
              slices={d.tournamentMix.map((r) => ({
                label: t.dyn(TOURNAMENT_STATUS[r.status]?.label ?? r.status),
                value: r.n,
                color:
                  r.status === "ongoing"
                    ? "var(--color-success)"
                    : r.status === "registration"
                      ? "var(--color-info)"
                      : r.status === "completed"
                        ? "var(--color-ink-muted)"
                        : "var(--color-violet)",
              }))}
            />
          </CardContent>
        </Card>

        {/* Activity */}
        {canActivity && <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              {t("Aktivitas Terbaru")}
            </CardTitle>
            <span className="text-[11px] text-ink-muted">{t("Jejak audit menyeluruh")}</span>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={d.activity} />
          </CardContent>
        </Card>}
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-muted">
        {t("Data diperbarui otomatis setiap {s} detik · {n} pertandingan tercatat lengkap dengan jejak kejadian", { s: 20, n: fmt.number(k.matchesCompleted) })}
      </p>
    </div>
  );
}
