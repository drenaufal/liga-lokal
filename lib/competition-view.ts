/*
  How the Turnamen list and the schedules are narrowed down, shared by the pages
  and by scripts/test-logic.ts. Nothing here touches the database or React.
*/

import { msg } from "@/lib/i18n/translate";

/* ── Turnamen list ─────────────────────────────────────────────────────── */

/**
 * Groups of KU statuses the list can be narrowed to. "running" is what the
 * page opens on: it is what operators come for, and everything else is one
 * click away (each chip carries a count, so nothing is hidden silently).
 */
export const COMPETITION_VIEWS = ["running", "upcoming", "completed", "archived", "all"] as const;
export type CompetitionView = (typeof COMPETITION_VIEWS)[number];
export type CompetitionBucket = Exclude<CompetitionView, "all">;

export const DEFAULT_COMPETITION_VIEW: CompetitionView = "running";

export const COMPETITION_VIEW_LABEL: Record<CompetitionView, string> = {
  running: msg("Berlangsung"),
  upcoming: msg("Persiapan"),
  completed: msg("Selesai"),
  archived: msg("Arsip"),
  all: msg("Semua"),
};

/** `?status=` of the list → a view; anything unknown opens the default one. */
export function parseCompetitionView(raw: string | undefined): CompetitionView {
  return (COMPETITION_VIEWS as readonly string[]).includes(raw ?? "")
    ? (raw as CompetitionView)
    : DEFAULT_COMPETITION_VIEW;
}

type CompetitionLike = {
  /** Derived from its KUs, see competitionStatus. */
  status: string;
  liveMatches: number;
  createdAt?: Date | string | null;
};

/**
 * Which group a Turnamen belongs to. A match in play means it is running, even
 * while its KUs are still marked draft or registration (a status somebody forgot
 * to advance must not hide a live match).
 */
export function competitionBucket(c: Pick<CompetitionLike, "status" | "liveMatches">): CompetitionBucket {
  if (c.status === "archived") return "archived";
  if (c.status === "completed") return "completed";
  if (c.status === "ongoing" || c.liveMatches > 0) return "running";
  return "upcoming";
}

/** Counts per group, plus the total under "all". */
export function countByBucket(list: Pick<CompetitionLike, "status" | "liveMatches">[]) {
  const counts: Record<CompetitionView, number> = { running: 0, upcoming: 0, completed: 0, archived: 0, all: list.length };
  for (const c of list) counts[competitionBucket(c)]++;
  return counts;
}

const BUCKET_ORDER: CompetitionBucket[] = ["running", "upcoming", "completed", "archived"];

/** Live ones first, then running → preparing → finished → archived; newest first inside each. */
export function sortCompetitions<T extends CompetitionLike>(list: T[]): T[] {
  const time = (c: T) => (c.createdAt ? new Date(c.createdAt).getTime() : 0);
  return [...list].sort(
    (a, b) =>
      Number(b.liveMatches > 0) - Number(a.liveMatches > 0) ||
      BUCKET_ORDER.indexOf(competitionBucket(a)) - BUCKET_ORDER.indexOf(competitionBucket(b)) ||
      time(b) - time(a),
  );
}

/** Free-text match on the name, season, organizer and the KU codes ("KU-10"). */
export function matchesCompetitionQuery(
  c: { name: string; season: string; organizer: string | null; kus: { ageCode: string | null }[] },
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.name, c.season, c.organizer, ...c.kus.map((k) => k.ageCode)].some((v) => v?.toLowerCase().includes(q));
}

/* ── Filters and sort of the list ──────────────────────────────────────── */

export const COMPETITION_FORMATS = ["league", "cup"] as const;

/** What the list can be ordered by; "relevance" is the opening order (see sortCompetitions). */
export const COMPETITION_SORTS = [
  "relevance",
  "name",
  "season",
  "start",
  "end",
  "kus",
  "clubs",
  "matches",
  "progress",
  "created",
] as const;
export type CompetitionSort = (typeof COMPETITION_SORTS)[number];
export type SortDir = "asc" | "desc";

export const COMPETITION_SORT_LABEL: Record<CompetitionSort, string> = {
  relevance: msg("Relevan"),
  name: msg("Nama"),
  season: msg("Musim"),
  start: msg("Tanggal mulai"),
  end: msg("Tanggal selesai"),
  kus: msg("Jumlah KU"),
  clubs: msg("Jumlah SSB"),
  matches: msg("Pertandingan"),
  progress: msg("Progres"),
  created: msg("Terbaru dibuat"),
};

/** The direction a sort opens in: names A→Z, everything else biggest or newest first. */
export const COMPETITION_SORT_DEFAULT_DIR: Record<CompetitionSort, SortDir> = {
  relevance: "asc",
  name: "asc",
  season: "desc",
  start: "desc",
  end: "desc",
  kus: "desc",
  clubs: "desc",
  matches: "desc",
  progress: "desc",
  created: "desc",
};

/** Everything the list reads from its query string, already validated. Empty string = not set. */
export type CompetitionFilters = {
  q: string;
  view: CompetitionView;
  season: string;
  /** Age-group code, "KU-10". */
  ku: string;
  /** Club id. */
  club: string;
  organizer: string;
  /** "league" or "cup": has a KU of that format. */
  format: string;
  /** YYYY-MM-DD; the Turnamen's dates must overlap [from, to]. */
  from: string;
  to: string;
  sort: CompetitionSort;
  dir: SortDir;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCompetitionFilters(raw: Record<string, string | undefined>): CompetitionFilters {
  const sort = (COMPETITION_SORTS as readonly string[]).includes(raw.sort ?? "") ? (raw.sort as CompetitionSort) : "relevance";
  return {
    q: raw.q?.trim() ?? "",
    view: parseCompetitionView(raw.status),
    season: raw.season?.trim() ?? "",
    ku: raw.ku?.trim() ?? "",
    club: raw.club?.trim() ?? "",
    organizer: raw.organizer?.trim() ?? "",
    format: (COMPETITION_FORMATS as readonly string[]).includes(raw.format ?? "") ? (raw.format as string) : "",
    from: ISO_DATE.test(raw.from ?? "") ? (raw.from as string) : "",
    to: ISO_DATE.test(raw.to ?? "") ? (raw.to as string) : "",
    sort,
    dir: raw.dir === "asc" || raw.dir === "desc" ? raw.dir : COMPETITION_SORT_DEFAULT_DIR[sort],
  };
}

type Filterable = {
  name: string;
  season: string;
  organizer: string | null;
  startDate: string | null;
  endDate: string | null;
  kus: { ageCode: string | null; format: string }[];
  clubs: { id: string; name: string }[];
};

/** Does [startDate, endDate] touch [from, to]? An open end of the range matches everything on that side. */
function overlapsDates(c: Pick<Filterable, "startDate" | "endDate">, from: string, to: string) {
  if (!from && !to) return true;
  const start = c.startDate ?? c.endDate;
  const end = c.endDate ?? c.startDate;
  if (!start || !end) return false; // a Turnamen without dates cannot be placed in a period
  return (!to || start <= to) && (!from || end >= from);
}

/** Search text and every value filter — all but the status chips, which are counted on this result. */
export function matchesCompetitionFilters(
  c: Filterable,
  f: Pick<CompetitionFilters, "q" | "season" | "ku" | "club" | "organizer" | "format" | "from" | "to">,
) {
  return (
    matchesCompetitionQuery(c, f.q) &&
    (!f.season || c.season === f.season) &&
    (!f.ku || c.kus.some((k) => k.ageCode === f.ku)) &&
    (!f.club || c.clubs.some((x) => x.id === f.club)) &&
    (!f.organizer || c.organizer === f.organizer) &&
    (!f.format || c.kus.some((k) => k.format === f.format)) &&
    overlapsDates(c, f.from, f.to)
  );
}

/** How many value filters are set (search, status and sort do not count; a date range counts once). */
export function activeFilterCount(f: CompetitionFilters) {
  return [f.season, f.ku, f.club, f.organizer, f.format, f.from || f.to].filter(Boolean).length;
}

/** The choices each filter offers: only values that exist in the list, so none leads to nothing. */
export function competitionFilterOptions(list: Filterable[]) {
  const text = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const clubs = new Map<string, string>();
  for (const c of list) for (const x of c.clubs) clubs.set(x.id, x.name);
  return {
    seasons: [...new Set(list.map((c) => c.season))].sort((a, b) => text(b, a)),
    kus: [...new Set(list.flatMap((c) => c.kus.map((k) => k.ageCode)).filter((x): x is string => !!x))].sort(text),
    organizers: [...new Set(list.map((c) => c.organizer).filter((x): x is string => !!x))].sort(text),
    clubs: [...clubs].map(([id, name]) => ({ id, name })).sort((a, b) => text(a.name, b.name)),
    formats: COMPETITION_FORMATS.filter((f) => list.some((c) => c.kus.some((k) => k.format === f))),
  };
}

type Sortable = CompetitionLike &
  Filterable & { teams: number; totalMatches: number; playedMatches: number };

const SORT_VALUE: Record<Exclude<CompetitionSort, "relevance">, (c: Sortable) => string | number | null> = {
  name: (c) => c.name,
  season: (c) => c.season,
  start: (c) => c.startDate,
  end: (c) => c.endDate,
  kus: (c) => c.kus.length,
  clubs: (c) => c.teams,
  matches: (c) => c.totalMatches,
  progress: (c) => (c.totalMatches > 0 ? c.playedMatches / c.totalMatches : null),
  created: (c) => (c.createdAt ? new Date(c.createdAt).getTime() : null),
};

/**
 * The list in the order asked for. A Turnamen without a value for the sort (no dates,
 * no matches yet) goes last whichever way it runs; ties fall back to the name.
 */
export function sortCompetitionsBy<T extends Sortable>(list: T[], sort: CompetitionSort, dir: SortDir): T[] {
  if (sort === "relevance") return sortCompetitions(list);
  const value = SORT_VALUE[sort];
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    const d =
      typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    return sign * d || a.name.localeCompare(b.name);
  });
}

/* ── Schedules ─────────────────────────────────────────────────────────── */

/** Narrowing of a list of matches by where they are in time. */
export const MATCH_VIEWS = ["all", "upcoming", "live", "completed"] as const;
export type MatchView = (typeof MATCH_VIEWS)[number];

export const MATCH_VIEW_LABEL: Record<MatchView, string> = {
  all: msg("Semua"),
  upcoming: msg("Mendatang"),
  live: msg("Langsung"),
  completed: msg("Selesai"),
};

export function parseMatchView(raw: string | undefined): MatchView {
  return (MATCH_VIEWS as readonly string[]).includes(raw ?? "") ? (raw as MatchView) : "all";
}

/** The view a match belongs to; a cancelled match is only ever seen under "all". */
export function matchBucket(status: string): Exclude<MatchView, "all"> | null {
  if (status === "scheduled" || status === "postponed") return "upcoming";
  if (status === "live" || status === "halftime") return "live";
  if (status === "completed") return "completed";
  return null;
}

export function filterMatches<T extends { status: string }>(list: T[], view: MatchView): T[] {
  return view === "all" ? list : list.filter((m) => matchBucket(m.status) === view);
}

export function countMatches(list: { status: string }[]) {
  const counts: Record<MatchView, number> = { all: list.length, upcoming: 0, live: 0, completed: 0 };
  for (const m of list) {
    const b = matchBucket(m.status);
    if (b) counts[b]++;
  }
  return counts;
}
