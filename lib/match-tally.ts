/** What a player has done in a match — drives the counters and tags on the match page. */
export type PlayerTally = {
  goals: number;
  ownGoals: number;
  assists: number;
  shotsOn: number;
  shotsOff: number;
  saves: number;
  interceptions: number;
  yellow: number;
  /** Red cards, including the dismissal that follows a second yellow. */
  red: number;
  subOff: number | null;
  subOn: number | null;
};

export const emptyTally = (): PlayerTally => ({
  goals: 0,
  ownGoals: 0,
  assists: 0,
  shotsOn: 0,
  shotsOff: 0,
  saves: 0,
  interceptions: 0,
  yellow: 0,
  red: 0,
  subOff: null,
  subOn: null,
});

type TallyEvent = {
  type: string;
  minute: number;
  playerId: string | null;
  relatedPlayerId: string | null;
};

/**
 * Per-player counters from a match's events (voided ones must be left out).
 * Assists come from the paired "assist" events, as the stats engine counts them.
 */
export function buildTallies(events: TallyEvent[]): Record<string, PlayerTally> {
  const tallies: Record<string, PlayerTally> = {};
  const tally = (pid: string) => (tallies[pid] ??= emptyTally());
  for (const e of events) {
    if (!e.playerId) continue;
    const t = tally(e.playerId);
    switch (e.type) {
      case "goal":
      case "penalty_goal":
        t.goals++;
        break;
      case "own_goal":
        t.ownGoals++;
        break;
      case "assist":
        t.assists++;
        break;
      case "shot_on":
        t.shotsOn++;
        break;
      case "shot_off":
        t.shotsOff++;
        break;
      case "save":
        t.saves++;
        break;
      case "interception":
        t.interceptions++;
        break;
      case "yellow_card":
        t.yellow++;
        break;
      case "red_card":
      case "second_yellow":
        t.red++;
        break;
      case "substitution":
        t.subOff = e.minute;
        if (e.relatedPlayerId) tally(e.relatedPlayerId).subOn = e.minute;
        break;
    }
  }
  return tallies;
}
