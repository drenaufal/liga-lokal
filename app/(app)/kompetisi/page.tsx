import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Radio, CalendarDays, Users2, Layers, Trophy, X } from "lucide-react";
import { listCompetitions } from "@/lib/queries/competition";
import { requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { FilterDate, FilterPanel, FilterSelect, SearchBox, SortControl } from "@/components/app/list-controls";
import { FilterChips, hrefWith } from "@/components/app/filter-chips";
import {
  COMPETITION_SORTS,
  COMPETITION_SORT_DEFAULT_DIR,
  COMPETITION_SORT_LABEL,
  COMPETITION_VIEWS,
  COMPETITION_VIEW_LABEL,
  DEFAULT_COMPETITION_VIEW,
  activeFilterCount,
  competitionBucket,
  competitionFilterOptions,
  countByBucket,
  matchesCompetitionFilters,
  parseCompetitionFilters,
  sortCompetitionsBy,
} from "@/lib/competition-view";
import { formatLabel } from "@/lib/ku";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Kompetisi") };
}
export const dynamic = "force-dynamic";

/** A form control with its caption, so every filter is named, not just hinted by its placeholder. */
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}

/** Makes a filter select fill its grid cell instead of keeping the pill sizing of a toolbar. */
const FILL = "w-full sm:w-full sm:min-w-0";

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireViewerCapability("competition:view");
  const f = parseCompetitionFilters(await searchParams);
  const all = await listCompetitions();
  const canWrite = can(user, "competition:create");

  // The search and every value filter narrow first, so each status chip counts what it would show now.
  const options = competitionFilterOptions(all);
  const narrowed = all.filter((c) => matchesCompetitionFilters(c, f));
  const counts = countByBucket(narrowed);
  const rows = sortCompetitionsBy(
    f.view === "all" ? narrowed : narrowed.filter((c) => competitionBucket(c) === f.view),
    f.sort,
    f.dir,
  );
  const hidden = narrowed.length - rows.length;
  const filterCount = activeFilterCount(f);

  // The URL as the page currently sees it, minus anything left at its default.
  const current = {
    q: f.q || undefined,
    status: f.view === DEFAULT_COMPETITION_VIEW ? undefined : f.view,
    season: f.season || undefined,
    ku: f.ku || undefined,
    club: f.club || undefined,
    organizer: f.organizer || undefined,
    format: f.format || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    sort: f.sort === "relevance" ? undefined : f.sort,
    dir: f.sort !== "relevance" && f.dir !== COMPETITION_SORT_DEFAULT_DIR[f.sort] ? f.dir : undefined,
  };
  const href = (updates: Record<string, string | null>) => hrefWith("/kompetisi", current, updates);
  const NO_VALUE_FILTERS = { season: null, ku: null, club: null, organizer: null, format: null, from: null, to: null };

  const chips = COMPETITION_VIEWS
    // Running and "all" are always there; the others only when they lead somewhere.
    .filter((v) => v === DEFAULT_COMPETITION_VIEW || v === "all" || counts[v] > 0 || v === f.view)
    .map((v) => ({
      key: v,
      label: t.dyn(COMPETITION_VIEW_LABEL[v]),
      href: href({ status: v === DEFAULT_COMPETITION_VIEW ? null : v }),
      active: v === f.view,
      count: counts[v],
    }));

  // A value that no longer exists in the data (an old link) stays selectable, so the select never lies.
  const withCurrent = (values: string[], value: string) => (value && !values.includes(value) ? [value, ...values] : values);
  const plain = (v: string) => ({ value: v, label: v });
  const clubName = (id: string) => options.clubs.find((c) => c.id === id)?.name ?? id;

  const dateLabel =
    f.from && f.to
      ? t("Tanggal: {from} – {to}", { from: fmt.date(f.from), to: fmt.date(f.to) })
      : f.from
        ? t("Sejak {date}", { date: fmt.date(f.from) })
        : f.to
          ? t("Hingga {date}", { date: fmt.date(f.to) })
          : "";
  const applied = [
    f.season && { key: "season", label: t("Musim: {name}", { name: f.season }), clear: href({ season: null }) },
    f.ku && { key: "ku", label: t("KU: {name}", { name: f.ku }), clear: href({ ku: null }) },
    f.club && { key: "club", label: t("SSB: {name}", { name: clubName(f.club) }), clear: href({ club: null }) },
    f.organizer && { key: "organizer", label: t("Penyelenggara: {name}", { name: f.organizer }), clear: href({ organizer: null }) },
    f.format && { key: "format", label: t("Format: {name}", { name: t.dyn(formatLabel(f.format)) }), clear: href({ format: null }) },
    dateLabel && { key: "date", label: dateLabel, clear: href({ from: null, to: null }) },
  ].filter((x): x is { key: string; label: string; clear: string } => !!x);

  const showAll = href({ status: "all" });
  const clearSearch = href({ q: null });
  const resetFilters = href({ ...NO_VALUE_FILTERS, q: null });
  const narrowing = !!f.q || filterCount > 0;

  return (
    <div>
      <PageHeader
        title="Competition & Rules"
        description={t("Satu turnamen memiliki banyak KU — masing-masing dengan format Liga atau Cup, jadwal, klasemen, dan peserta sendiri.")}
        actions={
          canWrite && (
            <Button size="sm" href="/kompetisi/baru">
              <Plus className="size-3.5" /> {t("Turnamen Baru")}
            </Button>
          )
        }
      />

      {all.length > 0 && (
        <div className="mb-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterChips items={chips} label={t("Filter status turnamen")} />
            <SearchBox placeholder={t("Cari nama, musim, atau KU…")} />
          </div>

          <FilterPanel activeCount={filterCount}>
            <Card>
              {/* two to a row on a phone; the long ones (club, sort) take a row of their own there */}
              <div className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-4">
                <Labeled label={t("Musim")}>
                  <FilterSelect
                    param="season"
                    placeholder={t("Semua musim")}
                    options={withCurrent(options.seasons, f.season).map(plain)}
                    className={FILL}
                  />
                </Labeled>
                <Labeled label={t("KU")}>
                  <FilterSelect
                    param="ku"
                    placeholder={t("Semua KU")}
                    options={withCurrent(options.kus, f.ku).map(plain)}
                    className={FILL}
                  />
                </Labeled>
                <Labeled label={t("Format")}>
                  <FilterSelect
                    param="format"
                    placeholder={t("Semua format")}
                    options={options.formats.map((v) => ({ value: v, label: t.dyn(formatLabel(v)) }))}
                    className={FILL}
                  />
                </Labeled>
                <Labeled label={t("Penyelenggara")}>
                  <FilterSelect
                    param="organizer"
                    placeholder={t("Semua penyelenggara")}
                    options={withCurrent(options.organizers, f.organizer).map(plain)}
                    className={FILL}
                  />
                </Labeled>
                <div className="col-span-2 lg:col-span-1">
                  <Labeled label={t("SSB")}>
                    <FilterSelect
                      param="club"
                      placeholder={t("Semua SSB")}
                      options={options.clubs.map((c) => ({ value: c.id, label: c.name }))}
                      className={FILL}
                    />
                  </Labeled>
                </div>
                <Labeled label={t("Dari tanggal")}>
                  <FilterDate param="from" className="w-full" />
                </Labeled>
                <Labeled label={t("Sampai tanggal")}>
                  <FilterDate param="to" className="w-full" />
                </Labeled>
                <div className="col-span-2 min-w-0 lg:col-span-1">
                  <span className="mb-1 block text-[11px] font-semibold text-ink-secondary">{t("Urutkan")}</span>
                  <SortControl
                    placeholder={t.dyn(COMPETITION_SORT_LABEL.relevance)}
                    options={COMPETITION_SORTS.filter((s) => s !== "relevance").map((s) => ({
                      value: s,
                      label: t.dyn(COMPETITION_SORT_LABEL[s]),
                    }))}
                    defaults={COMPETITION_SORT_DEFAULT_DIR}
                  />
                </div>
              </div>
            </Card>
          </FilterPanel>

          {applied.length > 0 && (
            <div role="group" aria-label={t("Filter aktif")} className="flex flex-wrap items-center gap-1.5">
              {applied.map((a) => (
                <Link
                  key={a.key}
                  href={a.clear}
                  scroll={false}
                  aria-label={t("Hapus filter {label}", { label: a.label })}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 pl-3 pr-2 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/15"
                >
                  {a.label}
                  <X className="size-3" />
                </Link>
              ))}
              <Link href={resetFilters} scroll={false} className="ml-1 text-[11px] font-semibold text-ink-muted hover:text-ink hover:underline">
                {t("Atur ulang filter")}
              </Link>
            </div>
          )}

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <span>{t("{n} turnamen", { n: rows.length })}</span>
            {hidden > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{t("{n} lainnya disembunyikan", { n: hidden })}</span>
                <Link href={showAll} className="font-semibold text-brand hover:underline">
                  {t("Tampilkan semua")}
                </Link>
              </>
            )}
            {f.q && (
              <>
                <span aria-hidden>·</span>
                <Link href={clearSearch} className="font-semibold text-brand hover:underline">
                  {t("Hapus pencarian")}
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {all.length > 0 && rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={f.view === "running" && !narrowing ? t("Tidak ada turnamen yang sedang berlangsung") : t("Tidak ada turnamen yang cocok")}
          description={
            f.view === "running" && !narrowing
              ? t("Turnamen yang masih persiapan, sudah selesai, atau diarsipkan tidak ditampilkan di sini.")
              : t("Ubah pencarian, filter, atau status untuk melihat turnamen lain.")
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {/* "Show all" only when another status has something; otherwise it is the search or filters that find nothing. */}
              {narrowing && narrowed.length === 0 ? (
                <Button size="sm" variant="outline" href={filterCount > 0 ? resetFilters : clearSearch}>
                  {filterCount > 0 ? t("Atur ulang filter") : t("Hapus pencarian")}
                </Button>
              ) : (
                f.view !== "all" && (
                  <Button size="sm" variant="outline" href={showAll}>
                    {t("Tampilkan semua turnamen")}
                  </Button>
                )
              )}
              {canWrite && (
                <Button size="sm" href="/kompetisi/baru">
                  <Plus className="size-3.5" /> {t("Turnamen Baru")}
                </Button>
              )}
            </div>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={t("Belum ada turnamen")}
          description={
            canWrite
              ? t("Buat turnamen pertama, lalu tambahkan KU yang dipertandingkan di dalamnya.")
              : t("Turnamen akan tampil di sini setelah dibuat oleh operator.")
          }
          action={
            canWrite ? (
              <Button size="sm" href="/kompetisi/baru">
                <Plus className="size-3.5" /> {t("Buat turnamen")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((c) => {
            const progress = c.totalMatches > 0 ? (c.playedMatches / c.totalMatches) * 100 : 0;
            return (
              <Link
                key={c.id}
                href={`/kompetisi/${c.id}`}
                className="group rounded-xl border border-line bg-surface/70 p-4 transition-colors hover:border-brand/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink group-hover:text-brand">{c.name}</h3>
                      {c.liveMatches > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-danger">
                          <Radio className="size-3 animate-live" /> {t("{n} LANGSUNG", { n: c.liveMatches })}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {t("Musim {season}", { season: c.season })}
                      {c.organizer ? ` · ${c.organizer}` : ""}
                    </p>
                  </div>
                  <StatusBadge kind="tournament" value={c.status} dot />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {c.kus.length ? (
                    c.kus.map((k) => (
                      // A finished or archived KU is dimmed, so the ones still going stand out.
                      <Badge
                        key={k.id}
                        tone={k.status === "completed" || k.status === "archived" ? "neutral" : "info"}
                        className="!py-0"
                      >
                        {k.ageCode ?? "—"}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[11px] text-ink-muted">{t("Belum ada KU")}</span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Layers className="size-3" /> {t("{n} KU", { n: c.kus.length })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users2 className="size-3" /> {t("{n} SSB", { n: c.teams })}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {c.startDate ? fmt.date(c.startDate) : "—"}
                    {c.endDate && c.endDate !== c.startDate ? ` – ${fmt.date(c.endDate)}` : ""}
                  </span>
                </div>

                {c.totalMatches > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[10px] text-ink-muted">
                      <span>{t("Progres pertandingan")}</span>
                      <span className="tabular-nums">
                        {c.playedMatches} / {c.totalMatches}
                      </span>
                    </div>
                    <Progress value={progress} tone={progress === 100 ? "success" : "brand"} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
