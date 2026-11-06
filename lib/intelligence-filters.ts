import { PLAYER_POSITIONS, POSITION_LINES, POSITION_NAME } from "@/lib/positions";
import { msg, type TFunction } from "@/lib/i18n/translate";

export type IntelligenceParams = Record<string, string | string[] | undefined>;
export type FilterField = {
  key: string; label: string; type?: "text" | "number" | "date";
  placeholder?: string; min?: number; max?: number; step?: number;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  groups?: { label: string; options: { value: string; label: string }[] }[];
};
export const PLAYER_SORTS = [
  { value: "score", label: msg("Skor performa") },
  { value: "name", label: msg("Nama pemain") },
  { value: "rating", label: msg("Rating") },
  { value: "appearances", label: msg("Penampilan") },
  { value: "minutesPlayed", label: msg("Menit bermain") },
  { value: "goals", label: msg("Goal") },
  { value: "assists", label: msg("Assist::statistik") },
  { value: "shotsOnTarget", label: msg("Shot on goal") },
  { value: "saves", label: msg("Saves") },
  { value: "interceptions", label: msg("Intercept") },
  { value: "shotsOffTarget", label: msg("Shot off target") },
  { value: "redCards", label: msg("Red card") },
  { value: "yellowCards", label: msg("Yellow card") },
] as const;
export type PlayerSort = (typeof PLAYER_SORTS)[number]["value"];
export const paramValue = (params: IntelligenceParams, key: string) => {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
};
function bounded(value: string, fallback: number, min: number, max: number, integer = true) {
  if (!value.trim()) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, integer ? Math.floor(n) : n));
}
export function parsePlayerFilters(params: IntelligenceParams, defaultMinApps = 1) {
  const position = paramValue(params, "position");
  const sort = paramValue(params, "sort");
  return {
    q: paramValue(params, "q").trim().slice(0, 200),
    position: [...PLAYER_POSITIONS, "DF", "MF", "FW"].includes(position) ? position : "",
    age: paramValue(params, "age"), club: paramValue(params, "club"),
    minApps: bounded(paramValue(params, "minApps"), defaultMinApps, 1, 10000),
    minRating: bounded(paramValue(params, "minRating"), 0, 0, 10, false),
    sort: (PLAYER_SORTS.some((s) => s.value === sort) ? sort : "score") as PlayerSort,
    order: paramValue(params, "order") === "asc" ? "asc" as const : "desc" as const,
    ...parsePagination(params),
  };
}
export function parsePagination(params: IntelligenceParams) {
  const size = Number(paramValue(params, "pageSize"));
  return {
    page: bounded(paramValue(params, "page"), 1, 1, 100000),
    pageSize: [12, 20, 40, 80].includes(size) ? size : 20,
  };
}
export function pageWindow(total: number, requested: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requested), pages);
  return { page, pages, pageSize, total, offset: (page - 1) * pageSize };
}
export function queryHref(params: IntelligenceParams, updates: Record<string, string | null>) {
  const query = new URLSearchParams();
  for (const key of Object.keys(params)) {
    const value = paramValue(params, key);
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value) query.set(key, value); else query.delete(key);
  }
  return query.size ? "?" + query.toString() : "?";
}
export const positionField = (t: TFunction): FilterField => ({
  key: "position", label: t("Posisi"), placeholder: t("Semua posisi"),
  groups: [
    { label: t("Lini"), options: POSITION_LINES.map((p) => ({ value: p.line, label: t.dyn(p.label) })) },
    { label: t("Posisi spesifik"), options: PLAYER_POSITIONS.map((p) => ({ value: p, label: p + " · " + t.dyn(POSITION_NAME[p]) })) },
  ],
});
export const pagingFields = (t: TFunction): FilterField[] => [
  { key: "order", label: t("Arah urutan"), defaultValue: "desc", options: [{ value: "desc", label: t("Menurun (Z–A / terbesar)") }, { value: "asc", label: t("Menaik (A–Z / terkecil)") }] },
  { key: "pageSize", label: t("Hasil per halaman"), defaultValue: "20", options: [12, 20, 40, 80].map((n) => ({ value: String(n), label: String(n) })) },
];
export type PlayerFilterOptions = { ages: { code: string }[]; clubs: { id: string; name: string }[] };
export function playerFilterFields(options: PlayerFilterOptions, t: TFunction, defaultMinApps = 1, draft = false): FilterField[] {
  return [
    { key: "q", label: t("Nama pemain"), placeholder: t("Cari nama pemain…") }, positionField(t),
    { key: "club", label: t("SSB"), placeholder: t("Semua SSB"), options: options.clubs.map((c) => ({ value: c.id, label: c.name })) },
    { key: "age", label: t("Kategori usia"), placeholder: t("Semua KU"), options: options.ages.map((a) => ({ value: a.code, label: a.code })) },
    { key: "minApps", label: t("Minimum penampilan"), type: "number", min: 1, max: 10000, step: 1, defaultValue: String(defaultMinApps) },
    { key: "minRating", label: t("Minimum rating"), type: "number", min: 0, max: 10, step: 0.1, defaultValue: "0" },
    { key: "sort", label: t("Urutkan pemain"), defaultValue: "score", options: PLAYER_SORTS.map((s) => ({ value: s.value, label: draft && s.value === "score" ? t("Skor draf") : t(s.label) })) },
    ...pagingFields(t),
  ];
}

/** The filter fields without the sort controls, for lists that are always ranked by score. */
export const withoutSortFields = (fields: FilterField[]) => fields.filter((f) => f.key !== "sort" && f.key !== "order");

/** Shared by the live formula preview; rank numbers stay based on score, regardless of display order. */
export function sortPlayerRows<T extends { id: string; name: string }>(rows: T[], sort: PlayerSort, order: "asc" | "desc", metric: (row: T, key: Exclude<PlayerSort, "name">) => number): T[] {
  const direction = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const primary = sort === "name" ? a.name.localeCompare(b.name, "id") : metric(a, sort) - metric(b, sort);
    return direction * primary || a.name.localeCompare(b.name, "id") || a.id.localeCompare(b.id);
  });
}
