/**
 * Match clock helpers — pure, so both server actions and client components can
 * use them (lib/match-engine.ts pulls in the database and cannot be imported
 * from the browser).
 */

export const DEFAULT_MATCH_MINUTES = 90;
export const MIN_MATCH_MINUTES = 10;
export const MAX_MATCH_MINUTES = 120;
/** Quick-pick durations offered when starting a match. */
export const DURATION_PRESETS = [40, 60, 70, 80, 90];

/** Stoppage allowance shown past the nominal full time. */
const STOPPAGE = 10;

export type ClockState = {
  status: string;
  currentMinute: number;
  clockStartedAt: Date | string | null;
};

/** Highest minute the clock will show: full time plus stoppage. */
export function clockCap(duration: number) {
  return duration + STOPPAGE;
}

/** Half-time minute for a match of this length. */
export function halfOf(duration: number) {
  return Math.ceil(duration / 2);
}

/** Minute the match is at right now: stored minute + the time the clock has run. */
export function elapsedMinute(c: ClockState, cap: number, now = Date.now()) {
  if (c.status !== "live" || !c.clockStartedAt) return c.currentMinute;
  const run = Math.floor((now - new Date(c.clockStartedAt).getTime()) / 60000);
  return Math.min(cap, c.currentMinute + Math.max(0, run));
}

/** What the clock shows right now: time left, and stoppage once it has run out. */
export type ClockView = {
  running: boolean;
  /** Seconds played so far. */
  elapsedSec: number;
  /** Seconds left of the nominal match length (never below 0). */
  remainingSec: number;
  /** Nominal time is up — the match stays live until an operator ends it. */
  expired: boolean;
  /** Whole minutes played past full time (0 until expired), capped at the stoppage allowance. */
  overtimeMin: number;
};

export function clockView(c: ClockState, duration: number, now = Date.now()): ClockView {
  const running = c.status === "live" && !!c.clockStartedAt;
  const run = running ? Math.max(0, (now - new Date(c.clockStartedAt as Date | string).getTime()) / 1000) : 0;
  const elapsedSec = c.currentMinute * 60 + run;
  const total = duration * 60;
  const expired = elapsedSec >= total;
  return {
    running,
    elapsedSec,
    remainingSec: Math.max(0, Math.ceil(total - elapsedSec)),
    expired,
    overtimeMin: expired ? Math.min(STOPPAGE, Math.floor((elapsedSec - total) / 60)) : 0,
  };
}

/** 4210 → "70:10". */
export function formatCountdown(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * SQL for a match's length: its own setting, else the age category rule, else
 * 90. Correlated on the (un-aliased) matches table.
 */
export const MATCH_DURATION_SQL = `coalesce(matches.duration_minutes, (select cast(json_value(_a.rules, '$.matchDuration') as signed) from tournaments _t join age_categories _a on _a.id = _t.age_category_id where _t.id = matches.tournament_id), ${DEFAULT_MATCH_MINUTES})`;
