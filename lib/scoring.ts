import type { FormulaWeights } from "@/lib/db/schema";
import { msg } from "@/lib/i18n/translate";

/**
 * The formula follows the one-tap buttons on the match page (see `lib/quick-events.ts`) and keeps
 * playing time. Anything the operators cannot record with a button does not score.
 */
export const DEFAULT_WEIGHTS: FormulaWeights = {
  goal: 6,
  assist: 4,
  shotOn: 0.8,
  shotOff: 0.1,
  interception: 1,
  yellowCard: -1.5,
  redCard: -5,
  minutesPer90: 1.5,
};

export const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as (keyof FormulaWeights)[];

/** Message ids: render with `t.dyn(label)`. Same wording as the buttons on the match page. */
export const WEIGHT_LABELS: Record<keyof FormulaWeights, string> = {
  goal: msg("Gol"),
  assist: "Assist",
  shotOn: msg("Tembakan tepat sasaran"),
  shotOff: msg("Tembakan meleset"),
  interception: msg("Intersep"),
  yellowCard: msg("Kartu kuning"),
  redCard: msg("Kartu merah"),
  minutesPer90: msg("Menit / 90"),
};

/** Slider range of each weight; the server clamps to it too. */
export const WEIGHT_RANGE: Record<keyof FormulaWeights, readonly [min: number, max: number]> = {
  goal: [0, 12],
  assist: [0, 8],
  shotOn: [0, 4],
  shotOff: [-2, 2],
  interception: [0, 8],
  yellowCard: [-8, 8],
  redCard: [-8, 8],
  minutesPer90: [0, 8],
};

const clampWeight = (key: keyof FormulaWeights, value: number) => {
  const [min, max] = WEIGHT_RANGE[key];
  return Math.min(max, Math.max(min, value));
};

/**
 * Weights as stored → a complete, current `FormulaWeights`. Missing or non-numeric keys fall
 * back to the defaults and keys that no longer exist (saved by an older version) are dropped, so
 * an old formula row never turns a score into NaN.
 */
export function normalizeWeights(raw: unknown): FormulaWeights {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    WEIGHT_KEYS.map((k) => {
      const v = source[k];
      return [k, typeof v === "number" && Number.isFinite(v) ? clampWeight(k, v) : DEFAULT_WEIGHTS[k]];
    }),
  ) as FormulaWeights;
}

/** Weights submitted from the editor: same shape as stored ones, but unknown input becomes 0. */
export function weightsFromInput(raw: Record<string, number>): FormulaWeights {
  return Object.fromEntries(
    WEIGHT_KEYS.map((k) => [k, clampWeight(k, Number.isFinite(raw[k]) ? Number(raw[k]) : 0)]),
  ) as FormulaWeights;
}

export type ScorableStats = {
  goals: number;
  assists: number;
  shotsOnTarget: number;
  shotsOffTarget: number;
  interceptions: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
};

/** The stat line `computeScore` reads, picked from any row that has these counters. */
export function scorableOf(s: ScorableStats): ScorableStats {
  return {
    goals: s.goals,
    assists: s.assists,
    shotsOnTarget: s.shotsOnTarget,
    shotsOffTarget: s.shotsOffTarget,
    interceptions: s.interceptions,
    yellowCards: s.yellowCards,
    redCards: s.redCards,
    minutesPlayed: s.minutesPlayed,
  };
}

/** Weighted performance score used by leaderboards, ratings and the radar. */
export function computeScore(
  s: ScorableStats,
  w: FormulaWeights = DEFAULT_WEIGHTS,
): number {
  const per90 = s.minutesPlayed / 90;
  const raw =
    s.goals * w.goal +
    s.assists * w.assist +
    s.shotsOnTarget * w.shotOn +
    s.shotsOffTarget * w.shotOff +
    s.interceptions * w.interception +
    s.yellowCards * w.yellowCard +
    s.redCards * w.redCard +
    per90 * w.minutesPer90;
  return Math.round(raw * 10) / 10;
}

/** 0–10 match-style rating derived from the weighted score per appearance. */
export function computeRating(
  s: ScorableStats,
  appearances: number,
  w: FormulaWeights = DEFAULT_WEIGHTS,
): number {
  if (appearances <= 0) return 6.0;
  const perGame = computeScore(s, w) / appearances;
  // Map a typical per-game contribution (~0–14) onto 5.8–9.4
  const rating = 5.8 + Math.max(0, Math.min(14, perGame)) * 0.26;
  return Math.round(Math.min(9.6, rating) * 10) / 10;
}

/** Percentile rank (0–100) of `value` within `pool`. */
export function percentile(value: number, pool: number[]): number {
  if (pool.length === 0) return 50;
  const below = pool.filter((v) => v < value).length;
  const equal = pool.filter((v) => v === value).length;
  return Math.round(((below + equal / 2) / pool.length) * 100);
}
