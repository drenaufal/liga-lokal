/**
 * Turns a match's events (and its line-up, when there is one) into per-player
 * statistic lines — what the match "adds" to each player. Pure: no database,
 * so it is easy to test and safe to import anywhere.
 */
import { withAutomaticSaves } from "./automatic-saves";

export const LINE_COUNTERS = [
  "appearances",
  "minutesPlayed",
  "goals",
  "assists",
  "saves",
  "shotsOnTarget",
  "shotsOffTarget",
  "interceptions",
  "foulsCommitted",
  "yellowCards",
  "redCards",
  "motm",
] as const;

export type LineCounter = (typeof LINE_COUNTERS)[number];

export type MatchLine = { playerId: string; clubId: string | null } & Record<LineCounter, number>;

export type LineEvent = {
  type: string;
  minute: number;
  clubId: string | null;
  playerId: string | null;
  relatedPlayerId: string | null;
  detail?: unknown;
  createdAt?: Date | string;
};

export type LineLineup = {
  playerId: string;
  clubId: string;
  role: "starter" | "substitute";
  position?: string;
  slot?: string | null;
  subInMinute?: number | null;
  subOutMinute?: number | null;
};

export function emptyLine(playerId: string, clubId: string | null): MatchLine {
  return {
    playerId,
    clubId,
    appearances: 0,
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    shotsOnTarget: 0,
    shotsOffTarget: 0,
    interceptions: 0,
    foulsCommitted: 0,
    yellowCards: 0,
    redCards: 0,
    motm: 0,
  };
}

/**
 * Who took part and what they did.
 *
 * - A player took part if he started, came on, or has any recorded event.
 * - Minutes come from the line-up / substitution events when there are any;
 *   otherwise a player with events is assumed to have played the whole match.
 * - A goal also counts as a shot on target. A second yellow counts as a yellow
 *   card (the dismissal itself is not a separate red card).
 *
 * `events` must already exclude voided ones. `length` is how long the match
 * actually ran, in minutes.
 */
export function buildMatchLines(input: {
  length: number;
  events: LineEvent[];
  lineups: LineLineup[];
  /** Club to use when neither the line-up nor his events say which side he played for. */
  fallbackClub?: (playerId: string) => string | null;
}): MatchLine[] {
  const { length, lineups, fallbackClub } = input;
  const events: LineEvent[] = withAutomaticSaves(input.events, lineups);

  const lineupOf = new Map(lineups.map((l) => [l.playerId, l]));
  // Every time a player goes on / comes off, in match order. A player can go off and come back on.
  const marks = new Map<string, { minute: number; on: boolean }[]>();
  const mark = (pid: string, minute: number, on: boolean) => {
    const list = marks.get(pid) ?? [];
    list.push({ minute, on });
    marks.set(pid, list);
  };
  const firstMinute = new Map<string, number>();
  const clubSeen = new Map<string, string>();
  const participants = new Set<string>();

  for (const l of lineups) {
    if (l.role === "starter") participants.add(l.playerId);
    else if (l.subInMinute != null) {
      participants.add(l.playerId);
      mark(l.playerId, l.subInMinute, true);
    }
    if (l.subOutMinute != null) mark(l.playerId, l.subOutMinute, false);
  }

  for (const e of events) {
    if (e.type === "substitution") {
      if (e.playerId) mark(e.playerId, e.minute, false); // player going off
      if (e.relatedPlayerId) {
        mark(e.relatedPlayerId, e.minute, true); // player coming on
        participants.add(e.relatedPlayerId);
        if (e.clubId && !clubSeen.has(e.relatedPlayerId)) clubSeen.set(e.relatedPlayerId, e.clubId);
      }
    }
    if (e.playerId) {
      participants.add(e.playerId);
      if (!firstMinute.has(e.playerId)) firstMinute.set(e.playerId, e.minute);
      if (e.clubId && !clubSeen.has(e.playerId)) clubSeen.set(e.playerId, e.clubId);
    }
    if ((e.type === "goal" || e.type === "penalty_goal") && e.relatedPlayerId) {
      participants.add(e.relatedPlayerId); // the assister was on the pitch too
    }
  }

  /** Minutes on the pitch, adding up every stint. */
  const minutesOn = (pid: string, role: LineLineup["role"] | undefined) => {
    const list = (marks.get(pid) ?? []).sort((x, y) => x.minute - y.minute); // stable: ties keep match order
    // Where the first stint starts. A reserve who was never sent on (he only has events) is assumed
    // to have been on from his first event; someone with no line-up row who first appears coming on
    // starts then, otherwise at kick-off.
    let from: number | null;
    if (role === "starter") from = 0;
    else if (role === "substitute") from = list.some((m) => m.on) ? null : (firstMinute.get(pid) ?? 0);
    else from = list[0]?.on ? null : 0;
    let total = 0;
    for (const m of list) {
      if (m.on && from === null) from = m.minute;
      else if (!m.on && from !== null) {
        total += Math.max(0, m.minute - from);
        from = null;
      }
    }
    if (from !== null) total += Math.max(0, length - from);
    return total;
  };

  const lines = new Map<string, MatchLine>();
  for (const pid of participants) {
    const lu = lineupOf.get(pid);
    const clubId = lu?.clubId ?? clubSeen.get(pid) ?? fallbackClub?.(pid) ?? null;
    const line = emptyLine(pid, clubId);
    line.appearances = 1;
    line.minutesPlayed = Math.max(1, Math.min(length, minutesOn(pid, lu?.role)));
    lines.set(pid, line);
  }

  for (const e of events) {
    const line = e.playerId ? lines.get(e.playerId) : undefined;
    if (!line) continue;
    switch (e.type) {
      case "goal":
      case "penalty_goal":
        line.goals++;
        line.shotsOnTarget++;
        break;
      case "assist":
        line.assists++;
        break;
      case "save":
        line.saves++;
        break;
      case "shot_on":
        line.shotsOnTarget++;
        break;
      case "shot_off":
        line.shotsOffTarget++;
        break;
      case "interception":
        line.interceptions++;
        break;
      case "foul":
        line.foulsCommitted++;
        break;
      case "yellow_card":
      case "second_yellow":
        line.yellowCards++;
        break;
      case "red_card":
        line.redCards++;
        break;
      case "var_check":
        if ((e.detail as { award?: string } | null | undefined)?.award) line.motm++;
        break;
    }
  }

  return [...lines.values()];
}

/** `next − prev` for every counter. */
export function diffLines(next: MatchLine, prev: MatchLine): Record<LineCounter, number> {
  const out = {} as Record<LineCounter, number>;
  for (const f of LINE_COUNTERS) out[f] = next[f] - prev[f];
  return out;
}

export function isZeroDelta(d: Record<LineCounter, number>) {
  return LINE_COUNTERS.every((f) => d[f] === 0);
}
