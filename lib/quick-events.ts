/**
 * The one-tap buttons next to every player's name on the match page, in
 * the order the operators asked for. Cards are not here: they are recorded
 * through the ⋯ form. Pure, so both the page and the server action can share it.
 */
export const QUICK_TYPES = [
  "goal",
  "assist",
  "shot_on",
  "interception",
  "shot_off",
] as const;

export type QuickType = (typeof QUICK_TYPES)[number];

/**
 * Team counters on the match page (between the players on the pitch and the
 * substitutes). They belong to the club, never to a player, and only count
 * for the match itself: fouls and corners show in the match statistics,
 * passes feed ball possession.
 */
export const TEAM_COUNTER_TYPES = ["foul", "corner", "pass"] as const;

export type TeamCounterType = (typeof TEAM_COUNTER_TYPES)[number];

export type TeamCounts = Record<TeamCounterType, number>;

export function emptyTeamCounts(): TeamCounts {
  return { foul: 0, corner: 0, pass: 0 };
}

/** Per club: how many fouls, corners and passes are on record (voided events excluded). */
export function buildTeamCounts(
  events: { type: string; clubId: string | null; voided?: boolean }[],
  clubIds: (string | null)[],
): Record<string, TeamCounts> {
  const out: Record<string, TeamCounts> = {};
  for (const id of clubIds) if (id) out[id] = emptyTeamCounts();
  for (const e of events) {
    if (e.voided || !e.clubId || !out[e.clubId]) continue;
    if ((TEAM_COUNTER_TYPES as readonly string[]).includes(e.type)) out[e.clubId][e.type as TeamCounterType]++;
  }
  return out;
}

/**
 * Ball possession from passes: a club's passes / both clubs' passes × 100, as whole
 * percentages that add up to 100. `null` while nobody has a pass recorded.
 */
export function possessionFromPasses(homePasses: number, awayPasses: number): { home: number; away: number } | null {
  const total = homePasses + awayPasses;
  if (total <= 0) return null;
  const home = Math.round((homePasses / total) * 100);
  return { home, away: 100 - home };
}
