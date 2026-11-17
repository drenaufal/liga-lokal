import { possessionFromPasses } from "@/lib/quick-events";

const STATISTICS = [
  { label: "Gol", type: "goal", events: ["goal", "penalty_goal"] },
  { label: "Assist", type: "assist", events: ["assist"] },
  { label: "Tembakan total", type: "shot_off", events: ["goal", "penalty_goal", "shot_on", "shot_off"] },
  { label: "Tepat sasaran", type: "shot_on", events: ["goal", "penalty_goal", "shot_on"] },
  { label: "Meleset", type: "shot_off", events: ["shot_off"] },
  { label: "Save", type: "save", events: ["save"] },
  { label: "Intersep", type: "interception", events: ["interception"] },
  { label: "Passing", type: "pass", events: ["pass"] },
  { label: "Sudut", type: "corner", events: ["corner"] },
  { label: "Pelanggaran", type: "foul", events: ["foul"] },
  { label: "Kartu merah", type: "red_card", events: ["red_card", "second_yellow"] },
  { label: "Kartu kuning", type: "yellow_card", events: ["yellow_card"] },
] as const;

export type MatchStatistic = {
  label: string;
  type: (typeof STATISTICS)[number]["type"];
  home: number;
  away: number;
};

type StatEvent = { type: string; clubId: string | null; minute?: number; voided?: boolean };

/** Team totals follow the player ledger: a second yellow is counted as a dismissal. */
export function buildMatchStatistics(
  events: StatEvent[],
  homeClubId: string | null,
  awayClubId: string | null,
): MatchStatistic[] {
  const active = events.filter((event) => !event.voided);
  const count = (clubId: string | null, types: readonly string[]) =>
    clubId ? active.filter((event) => event.clubId === clubId && types.includes(event.type)).length : 0;
  const saves = (clubId: string | null, opponentId: string | null) => {
    if (!clubId) return 0;
    const minutes = new Map<number, { shots: number; legacy: number }>();
    for (const e of active) {
      if (!((e.clubId === opponentId && e.type === "shot_on") || (e.clubId === clubId && e.type === "save"))) continue;
      const key = e.minute ?? 0;
      const tally = minutes.get(key) ?? { shots: 0, legacy: 0 };
      if (e.type === "shot_on") tally.shots++; else tally.legacy++;
      minutes.set(key, tally);
    }
    return [...minutes.values()].reduce((sum, m) => sum + Math.max(m.shots, m.legacy), 0);
  };
  return STATISTICS.map(({ label, type, events: types }) => ({
    label, type,
    home: type === "save" ? saves(homeClubId, awayClubId) : count(homeClubId, types),
    away: type === "save" ? saves(awayClubId, homeClubId) : count(awayClubId, types),
  }));
}

/**
 * Ball possession (%) from the passes recorded on the match page:
 * passes of a club / passes of both clubs × 100. `null` until a pass is recorded.
 */
export function buildPossession(events: StatEvent[], homeClubId: string | null, awayClubId: string | null) {
  const passes = (clubId: string | null) =>
    clubId ? events.filter((e) => !e.voided && e.type === "pass" && e.clubId === clubId).length : 0;
  return possessionFromPasses(passes(homeClubId), passes(awayClubId));
}
