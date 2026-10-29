import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetition,
  getCompetitionFixtures,
  getCompetitionKuOptions,
  getScheduleOptions,
} from "@/lib/queries/competition";
import { requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchRow, MatchStack } from "@/components/app/match-row";
import { FilterChips, hrefWith } from "@/components/app/filter-chips";
import { EmptyState } from "@/components/ui/misc";
import { MATCH_VIEWS, MATCH_VIEW_LABEL, countMatches, filterMatches, parseMatchView } from "@/lib/competition-view";
import { APP_TIME_ZONE } from "@/lib/utils";
import { AddMatch } from "../../add-match";
import { ScheduleUpload } from "../../schedule-upload";
import { DeleteMatchButton } from "../../delete-match-button";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** YYYY-MM-DD of an instant in WIB — the key a match day is grouped by. */
const wibDay = (d: Date | string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: APP_TIME_ZONE }).format(new Date(d));

/**
 * The schedule of a whole Turnamen: every KU's matches by day, narrowed by KU and
 * by whether a match is still to come, live or done. The same tools as inside a KU
 * (add a match, upload a CSV) — here with a KU picker, since a match always belongs
 * to one KU; it opens on the KU being filtered.
 */
export default async function CompetitionSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ku?: string; status?: string }>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireViewerCapability("competition:view");
  const { id } = await params;
  const { ku: kuFilter, status: statusParam } = await searchParams;
  const competition = await getCompetition(id);
  if (!competition) notFound();
  const canSchedule = can(user, "ku:schedule");
  const canDeleteMatch = can(user, "ku:match-delete");
  const canAddKu = can(user, "ku:create");

  const [all, kuOptions, options] = await Promise.all([
    getCompetitionFixtures(id),
    getCompetitionKuOptions(id),
    canSchedule ? getScheduleOptions() : Promise.resolve(null),
  ]);
  const selected = kuOptions.find((k) => k.id === kuFilter)?.id ?? null;
  const view = parseMatchView(statusParam);
  const ofKu = selected ? all.filter((m) => m.kuId === selected) : all;
  const counts = countMatches(ofKu);
  const matches = filterMatches(ofKu, view);

  const label = (k: (typeof kuOptions)[number]) => k.ageCode ?? t("Tanpa KU");
  const current = { ku: selected ?? undefined, status: view === "all" ? undefined : view };
  const href = (updates: Record<string, string | null>) => hrefWith(`/kompetisi/${id}/jadwal`, current, updates);

  const tools =
    canSchedule && options && kuOptions.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        <AddMatch
          // a new instance per KU filter, so the dialog opens on the KU being looked at
          key={selected ?? "all"}
          defaultKuId={selected ?? undefined}
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
        title={t("Belum ada KU")}
        description={t("Jadwal dibuat per KU. Tambahkan KU dahulu, lalu susun jadwalnya otomatis, manual, atau lewat unggah CSV.")}
        action={
          canAddKu ? (
            <Link href={`/kompetisi/${id}/ku/baru`} className="text-xs font-semibold text-brand hover:underline">
              {t("Tambah KU")}
            </Link>
          ) : undefined
        }
      />
    );
  }

  // match days, oldest first — results read newest first
  const days = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = wibDay(m.scheduledAt);
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(m);
  }
  const dayList = view === "completed" ? [...days.entries()].reverse() : [...days.entries()];
  const today = wibDay(new Date());

  const kuChips = [
    { key: "all", label: t("Semua KU"), href: href({ ku: null }), active: !selected },
    ...kuOptions.map((k) => ({
      key: k.id,
      label: label(k),
      href: href({ ku: k.id }),
      active: selected === k.id,
      live: all.some((m) => m.kuId === k.id && (m.status === "live" || m.status === "halftime")),
    })),
  ];
  const statusChips = MATCH_VIEWS
    // "all" is always there; a group with nothing in it would only be a dead end
    .filter((v) => v === "all" || counts[v] > 0 || v === view)
    .map((v) => ({
      key: v,
      label: t.dyn(MATCH_VIEW_LABEL[v]),
      href: href({ status: v === "all" ? null : v }),
      active: v === view,
      count: counts[v],
      live: v === "live",
    }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <FilterChips items={kuChips} label={t("Filter KU")} />
          <FilterChips items={statusChips} label={t("Filter status pertandingan")} />
        </div>
        {tools}
      </div>

      <p className="text-xs text-ink-muted">
        {selected ? t("{n} pertandingan", { n: matches.length }) : t("{n} pertandingan di {k} KU", { n: matches.length, k: kuOptions.length })}
      </p>

      {ofKu.length === 0 ? (
        <EmptyState
          title={t("Belum ada pertandingan")}
          description={t("Buat jadwal otomatis dari halaman KU, tambahkan pertandingan manual, atau unggah dari berkas CSV.")}
          action={tools}
        />
      ) : matches.length === 0 ? (
        <EmptyState
          title={t("Tidak ada pertandingan yang cocok")}
          description={t("Ubah filter untuk melihat pertandingan lain.")}
          action={
            <Button size="sm" variant="outline" href={href({ status: null })}>
              {t("Tampilkan semua")}
            </Button>
          }
        />
      ) : (
        dayList.map(([day, list]) => (
          <Card key={day}>
            <CardContent>
              <h3 className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                {fmt.date(list[0].scheduledAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {day === today && <Badge tone="brand">{t("Hari ini")}</Badge>}
              </h3>
              <MatchStack>
                {list.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <MatchRow m={m} />
                    </div>
                    {canDeleteMatch && m.status === "scheduled" && (
                      <DeleteMatchButton matchId={m.id} label={`${m.homeShort ?? "?"} vs ${m.awayShort ?? "?"}`} />
                    )}
                  </div>
                ))}
              </MatchStack>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
