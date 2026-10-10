/*
  Turnamen / KU vocabulary shared by server and client code.

  A Turnamen (`competitions`) holds many KUs; a KU is a row of `tournaments`
  (one age category with its own format, dates, teams and fixtures).
*/

export type TournamentFormat = "league" | "cup";

export const FORMAT_META: Record<string, { label: string; desc: string }> = {
  league: { label: "Liga", desc: "Round-robin: semua SSB saling bertemu, satu klasemen." },
  cup: { label: "Cup", desc: "Sistem gugur: kalah langsung tersingkir hingga final." },
};

export const formatLabel = (format: string) => FORMAT_META[format]?.label ?? format;

/** "<turnamen> · KU-14" — how a KU is named wherever it appears on its own. */
export function kuLabel(turnamen: string, ageCode?: string | null) {
  return ageCode ? `${turnamen} · ${ageCode}` : turnamen;
}

/** A competition format as the stages a fixture of it can carry. */
export const STAGES_BY_FORMAT: Record<string, string[]> = {
  league: ["league"],
  cup: ["round_of_32", "round_of_16", "quarter", "semi", "third_place", "final"],
};

/**
 * The stage a Cup of `teamCount` teams starts in: 2 → final, 3–4 → semi-final,
 * 5–8 → quarter-final … up to 32 teams (the same bracket sizes cupBracket makes).
 */
export function firstCupStage(teamCount: number): string {
  let size = 2;
  while (size < teamCount && size < 32) size *= 2;
  return ({ 2: "final", 4: "semi", 8: "quarter", 16: "round_of_16", 32: "round_of_32" } as Record<number, string>)[size];
}

/** The stage a new match of a KU should default to. */
export function defaultStage(format: string, teamCount: number): string {
  return format === "cup" ? firstCupStage(teamCount) : (STAGES_BY_FORMAT[format]?.[0] ?? "league");
}

/** Higher = further from done. A Turnamen shows the status of whatever is still moving. */
const STATUS_RANK: Record<string, number> = {
  ongoing: 6,
  ready: 5,
  verification: 4,
  registration: 3,
  draft: 2,
  completed: 1,
  archived: 0,
};

/**
 * Status of a Turnamen, derived from its KUs: the most advanced KU that is not
 * finished decides; when every KU is finished the Turnamen is "completed"
 * (or "archived" if all of them are). No KUs yet = "draft".
 */
export function competitionStatus(statuses: string[]): string {
  if (statuses.length === 0) return "draft";
  const open = statuses.filter((s) => s !== "completed" && s !== "archived");
  if (open.length) return open.reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a));
  return statuses.every((s) => s === "archived") ? "archived" : "completed";
}

/** Earliest and latest of a list of YYYY-MM-DD strings (nulls ignored). */
export function dateSpan(dates: (string | null | undefined)[]) {
  const ds = dates.filter((d): d is string => !!d).sort();
  return { from: ds[0] ?? null, to: ds[ds.length - 1] ?? null };
}
