/**
 * Turns a match's events (and its line-up, when there is one) into per-player
 * statistic lines — what the match "adds" to each player. Pure: no database,
 * so it is easy to test and safe to import anywhere.
 */

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
};

export type LineLineup = {
  playerId: string;
  clubId: string;
  role: "starter" | "substitute";
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
  const { length, events, lineups, fallbackClub } = input;

  const lineupOf = new Map(lineups.map((l) => [l.playerId, l]));
  const subOn = new Map<string, number>();
  const subOff = new Map<string, number>();
  const firstMinute = new Map<string, number>();
  const clubSeen = new Map<string, string>();
  const participants = new Set<string>();

  for (const l of lineups) {
    if (l.role === "starter") participants.add(l.playerId);
    else if (l.subInMinute != null) {
      participants.add(l.playerId);
      subOn.set(l.playerId, l.subInMinute);
    }
    if (l.subOutMinute != null) subOff.set(l.playerId, l.subOutMinute);
  }

  for (const e of events) {
    if (e.type === "substitution") {
      if (e.playerId) subOff.set(e.playerId, e.minute); // player going off
      if (e.relatedPlayerId) {
        subOn.set(e.relatedPlayerId, e.minute); // player coming on
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

  const lines = new Map<string, MatchLine>();
  for (const pid of participants) {
    const lu = lineupOf.get(pid);
    const clubId = lu?.clubId ?? clubSeen.get(pid) ?? fallbackClub?.(pid) ?? null;
    const line = emptyLine(pid, clubId);
    const start = subOn.get(pid) ?? (lu?.role === "substitute" ? (firstMinute.get(pid) ?? 0) : 0);
    const end = subOff.get(pid) ?? length;
    line.appearances = 1;
    line.minutesPlayed = Math.max(1, Math.min(length, Math.max(0, end - start)));
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
