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
  period?: string | null;
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

/** What the clock shows right now: elapsed count-up time, capped at half/full target when time is up. */
export type ClockView = {
  running: boolean;
  /** Actual seconds played so far. */
  elapsedSec: number;
  /** Seconds formatted and displayed on screen (counts up, stops at period target). */
  displaySec: number;
  /** Seconds left of the current period nominal length (0 once expired). */
  remainingSec: number;
  /** Target nominal minute for the current half (e.g. 20 for half 1, 40 for half 2). */
  periodTargetMin: number;
  /** Half or match nominal time is up — match remains live until operator stops it. */
  expired: boolean;
  /** Current period name ("first_half", "halftime", "second_half", etc.). */
  period: string;
  /** Whole minutes played past nominal time (0 until expired). */
  overtimeMin: number;
};

export function clockView(c: ClockState, duration: number, now = Date.now()): ClockView {
  const halfMin = halfOf(duration);
  const isHalftime = c.period === "halftime" || c.status === "halftime";
  const isSecondHalf = c.period === "second_half" || (!isHalftime && c.currentMinute >= halfMin);
  const period = isHalftime ? "halftime" : isSecondHalf ? "second_half" : (c.period || "first_half");

  const periodTargetMin = isSecondHalf ? duration : halfMin;
  const targetSec = periodTargetMin * 60;

  const running = c.status === "live" && !!c.clockStartedAt;
  const run = running ? Math.max(0, (now - new Date(c.clockStartedAt as Date | string).getTime()) / 1000) : 0;

  let elapsedSec: number;
  if (isHalftime) {
    elapsedSec = halfMin * 60;
  } else if (isSecondHalf) {
    elapsedSec = Math.max(halfMin * 60, c.currentMinute * 60) + run;
  } else {
    elapsedSec = c.currentMinute * 60 + run;
  }

  const expired = elapsedSec >= targetSec;
  // Timer stops at nominal period target when time is up; match remains live until operator ends the half.
  const displaySec = expired ? targetSec : elapsedSec;

  return {
    running,
    elapsedSec,
    displaySec,
    remainingSec: Math.max(0, Math.ceil(targetSec - elapsedSec)),
    periodTargetMin,
    expired,
    period,
    overtimeMin: expired ? Math.min(STOPPAGE, Math.floor((elapsedSec - targetSec) / 60)) : 0,
  };
}

/** 1205 → "20:05". */
export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Backward compatibility alias for formatClock. */
export const formatCountdown = formatClock;

/**
 * SQL for a match's length: its own setting, else the age category rule, else
 * 90. Correlated on the (un-aliased) matches table.
 */
export const MATCH_DURATION_SQL = `coalesce(matches.duration_minutes, (select cast(json_value(_a.rules, '$.matchDuration') as signed) from tournaments _t join age_categories _a on _a.id = _t.age_category_id where _t.id = matches.tournament_id), ${DEFAULT_MATCH_MINUTES})`;
