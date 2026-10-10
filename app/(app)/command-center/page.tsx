import type { Metadata } from "next";
import Link from "next/link";
import { Users, ShieldCheck, Trophy, Radio, ArrowUpRight, Activity } from "lucide-react";
import { getCommandCenterData } from "@/lib/queries/command-center";
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
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Command Center" };
export const dynamic = "force-dynamic";

const VERIF_COLORS: Record<string, string> = {
  verified: "var(--color-success)",
  pending: "var(--color-info)",
  flagged: "var(--color-warn)",
  rejected: "var(--color-danger)",
};

export default async function CommandCenterPage() {
  const d = await getCommandCenterData();
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
          <p className="py-6 text-center text-xs text-ink-muted">Belum ada data.</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <AutoRefresh seconds={20} />
      <PageHeader
        title="Command Center"
        description="Pemantauan menyeluruh kondisi sistem, kompetisi, dan pertandingan secara real-time."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pemain Terdaftar"
          value={formatNumber(k.players)}
          icon={<Users className="size-4" />}
          block="red"
          hint={`${formatNumber(k.playersVerified)} terverifikasi`}
        />
        <StatCard
          label="Klub Aktif"
          value={formatNumber(k.clubs)}
          icon={<ShieldCheck className="size-4" />}
          block="blue"
          hint={`${k.venues} venue terdaftar`}
        />
        <StatCard
          label="Pertandingan"
          value={formatNumber(k.matchesTotal)}
          icon={<Trophy className="size-4" />}
          block="yellow"
          hint={`${k.matchesCompleted} selesai · ${k.matchesUpcoming} akan datang`}
        />
        <StatCard
          label="Pertandingan Langsung"
          value={k.matchesLive}
          icon={<Radio className="size-4" />}
          block="night"
          tone={k.matchesLive > 0 ? "danger" : "default"}
          hint={`${k.refereesActive} wasit berlisensi aktif`}
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
                Semua pertandingan <ArrowUpRight className="size-3" />
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
                  title="Tidak ada pertandingan berlangsung"
                  description="Konsol pertandingan langsung akan muncul di sini saat pertandingan dimulai."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Verification compliance */}
        <Card>
          <CardHeader>
            <CardTitle>Kepatuhan Verifikasi Data</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <GaugeChart
              value={k.compliance}
              label="Terverifikasi"
              sublabel={`${formatNumber(k.playersVerified)} dari ${formatNumber(k.players)} pemain`}
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
        {leaderCard("Pencetak Gol Terbanyak", d.leaderboards.topScorers, "var(--color-chart-1)")}
        {leaderCard("Assist Terbanyak", d.leaderboards.topAssists, "var(--color-chart-3)")}
        {leaderCard("Penyelamatan Terbaik", d.leaderboards.topSaves, "var(--color-chart-4)")}
        {leaderCard("Pemain Terbaik (Skor)", d.leaderboards.topRated, "var(--color-chart-7)")}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Tournament status */}
        <Card>
          <CardHeader>
            <CardTitle>Status KU</CardTitle>
            <Link href="/kompetisi" className="text-[11px] text-ink-muted hover:text-ink">
              Kelola
            </Link>
          </CardHeader>
          <CardContent>
            <Donut
              centerLabel="KU"
              centerValue={String(d.tournamentMix.reduce((a, r) => a + r.n, 0))}
              slices={d.tournamentMix.map((r) => ({
                label: TOURNAMENT_STATUS[r.status]?.label ?? r.status,
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Aktivitas Terbaru
            </CardTitle>
            <span className="text-[11px] text-ink-muted">Jejak audit menyeluruh</span>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={d.activity} />
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-muted">
        Data diperbarui otomatis setiap 20 detik · {formatNumber(k.matchesCompleted)} pertandingan tercatat lengkap dengan jejak kejadian
      </p>
    </div>
  );
}
