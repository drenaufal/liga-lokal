import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetition,
  getCompetitionFixtures,
  getCompetitionKuOptions,
  getScheduleOptions,
} from "@/lib/queries/competition";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState } from "@/components/ui/misc";
import { APP_TIME_ZONE, cn, formatDate } from "@/lib/utils";
import { AddMatch } from "../../add-match";
import { ScheduleUpload } from "../../schedule-upload";
import { DeleteMatchButton } from "../../delete-match-button";

export const dynamic = "force-dynamic";

/** YYYY-MM-DD of an instant in WIB — the key a match day is grouped by. */
const wibDay = (d: Date | string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: APP_TIME_ZONE }).format(new Date(d));

/**
 * The schedule of a whole Turnamen: every KU's matches by day, with a KU
 * filter. The same tools as inside a KU (add a match, upload a CSV) — here
 * with a KU picker, since a match always belongs to one KU.
 */
export default async function CompetitionSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ku?: string }>;
}) {
  const { id } = await params;
  const { ku: kuFilter } = await searchParams;
  const competition = await getCompetition(id);
  if (!competition) notFound();
  const user = await getCurrentUser();
  const canManage = can(user?.role, "competition:write");

  const [all, kuOptions, options] = await Promise.all([
    getCompetitionFixtures(id),
    getCompetitionKuOptions(id),
    canManage ? getScheduleOptions() : Promise.resolve(null),
  ]);
  const selected = kuOptions.find((k) => k.id === kuFilter)?.id ?? null;
  const matches = selected ? all.filter((m) => m.kuId === selected) : all;

  const label = (k: (typeof kuOptions)[number]) => k.ageCode ?? "Tanpa KU";
  const tools =
    canManage && options && kuOptions.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        <AddMatch
          kus={kuOptions.map((k) => ({
            id: k.id,
            label: label(k),
            format: k.format,
            hasGroups: k.hasGroups,
            status: k.status,
            teams: k.teams,
          }))}
          options={options}
        />
        <ScheduleUpload
          kus={kuOptions
            .filter((k) => k.status !== "archived")
            .map((k) => ({ id: k.id, label: label(k), shorts: k.teams.map((t) => t.short).sort() }))}
        />
      </div>
    ) : null;

  if (kuOptions.length === 0) {
    return (
      <EmptyState
        title="Belum ada KU"
        description="Jadwal dibuat per KU. Tambahkan KU dahulu, lalu susun jadwalnya otomatis, manual, atau lewat unggah CSV."
        action={
          canManage ? (
            <Link href={`/kompetisi/${id}/ku/baru`} className="text-xs font-semibold text-brand hover:underline">
              Tambah KU
            </Link>
          ) : undefined
        }
      />
    );
  }

  // match days, oldest first
  const days = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = wibDay(m.scheduledAt);
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip href={`/kompetisi/${id}/jadwal`} active={!selected}>
            Semua KU
          </FilterChip>
          {kuOptions.map((k) => (
            <FilterChip key={k.id} href={`/kompetisi/${id}/jadwal?ku=${k.id}`} active={selected === k.id}>
              {label(k)}
            </FilterChip>
          ))}
        </div>
        {tools}
      </div>

      <p className="text-xs text-ink-muted">
        {matches.length} pertandingan{selected ? "" : ` di ${kuOptions.length} KU`}
      </p>

      {matches.length === 0 ? (
        <EmptyState
          title="Belum ada pertandingan"
          description="Buat jadwal otomatis dari halaman KU, tambahkan pertandingan manual, atau unggah dari berkas CSV."
          action={tools}
        />
      ) : (
        [...days.entries()].map(([day, list]) => (
          <Card key={day}>
            <CardContent>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                {formatDate(list[0].scheduledAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </h3>
              <div className="space-y-2">
                {list.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <MatchRow m={m} />
                    </div>
                    {canManage && m.status === "scheduled" && (
                      <DeleteMatchButton matchId={m.id} label={`${m.homeShort ?? "?"} vs ${m.awayShort ?? "?"}`} />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold transition-colors",
        active ? "bg-night text-white" : "bg-surface-2 text-ink-secondary hover:bg-elevated hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
