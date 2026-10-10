import type { Metadata } from "next";
import Link from "next/link";
import { Radio, Calendar, CheckCircle2 } from "lucide-react";
import { listMatches, type MatchListParams } from "@/lib/queries/match";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FilterSelect } from "@/components/app/list-controls";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { MatchRow } from "@/components/app/match-row";
import { ClubCrest } from "@/components/app/club-crest";
import { LiveCountdown } from "@/components/app/match-countdown";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Match Operations" };
export const dynamic = "force-dynamic";

export default async function MatchOpsPage({
  searchParams,
}: {
  searchParams: Promise<MatchListParams>;
}) {
  const params = await searchParams;
  const { rows, tournamentOpts } = await listMatches(params);

  const live = rows.filter((m) => m.status === "live");
  const upcoming = rows.filter((m) => m.status === "scheduled");
  const done = rows.filter((m) => m.status === "completed");

  return (
    <div>
      <AutoRefresh seconds={15} />
      <PageHeader
        title="Match Operations"
        description="Kendali pertandingan langsung dengan papan taktik visual, pencatatan kejadian, dan validasi hasil."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-2">
          <FilterSelect
            param="status"
            placeholder="Semua status"
            options={[
              { value: "live", label: "Langsung" },
              { value: "scheduled", label: "Terjadwal" },
              { value: "completed", label: "Selesai" },
            ]}
          />
          <FilterSelect
            param="tournament"
            placeholder="Semua turnamen & KU"
            groups={Object.entries(
              tournamentOpts.reduce<Record<string, { value: string; label: string }[]>>((acc, t) => {
                (acc[t.competition] ??= []).push({ value: t.id, label: t.ageCode ?? "Tanpa KU" });
                return acc;
              }, {}),
            ).map(([label, options]) => ({ label, options }))}
          />
        </CardContent>
      </Card>

      {live.length > 0 && (
        <Section
          icon={<Radio className="size-4 animate-live text-danger" />}
          title={`Sedang Berlangsung (${live.length})`}
        >
          <div className="grid gap-2 lg:grid-cols-2">
            {live.map((m) => (
              <ConsoleMatchRow key={m.id} m={m} />
            ))}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section icon={<Calendar className="size-4" />} title={`Terjadwal (${upcoming.length})`}>
          <div className="space-y-2">
            {upcoming.slice(0, 30).map((m) => (
              <ConsoleMatchRow key={m.id} m={m} />
            ))}
          </div>
        </Section>
      )}

      {done.length > 0 && (
        <Section
          icon={<CheckCircle2 className="size-4 text-success" />}
          title={`Selesai (${done.length})`}
        >
          <div className="space-y-2">
            {done.slice(0, 30).map((m) => (
              <ConsoleMatchRow key={m.id} m={m} />
            ))}
          </div>
        </Section>
      )}

      {rows.length === 0 && (
        <EmptyState title="Tidak ada pertandingan" description="Sesuaikan filter di atas." />
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function ConsoleMatchRow({
  m,
}: {
  m: Awaited<ReturnType<typeof listMatches>>["rows"][number];
}) {
  return (
    <Link
      href={`/match-ops/${m.id}`}
      className="flex items-center gap-3 rounded-lg border border-line-soft bg-surface-2/30 px-3 py-2.5 transition-colors hover:border-brand/40"
    >
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <span className="flex items-center justify-end gap-2 text-right">
          <span className="truncate text-xs font-medium text-ink">{m.homeName}</span>
          <ClubCrest logoUrl={m.homeLogo} short={m.homeShort} size={24} />
        </span>
        <span className="shrink-0 text-center font-mono text-sm font-bold tabular-nums text-ink">
          {m.status === "scheduled" ? (
            <span className="text-[10px] font-normal text-ink-muted">
              {formatDate(m.scheduledAt)}
            </span>
          ) : (
            <>
              {m.homeScore}<span className="mx-0.5 text-ink-muted">-</span>{m.awayScore}
            </>
          )}
        </span>
        <span className="flex items-center gap-2">
          <ClubCrest logoUrl={m.awayLogo} short={m.awayShort} size={24} />
          <span className="truncate text-xs font-medium text-ink">{m.awayName}</span>
        </span>
      </div>
      <div className="hidden w-40 shrink-0 text-right sm:block">
        <span className="block truncate text-[10px] text-ink-muted">{m.tournamentName}</span>
        {m.status === "live" ? (
          <span className="inline-flex items-center justify-end gap-1.5 text-[10px] font-semibold text-danger">
            <LiveCountdown
              status={m.status}
              currentMinute={m.currentMinute}
              clockStartedAt={m.clockStartedAt}
              duration={m.duration}
            />
            · LANGSUNG
          </span>
        ) : (
          <span className="text-[10px] text-ink-muted">{m.venue}</span>
        )}
      </div>
    </Link>
  );
}
