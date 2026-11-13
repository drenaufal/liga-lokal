/**
 * What the home page shows about tournaments that are on now or about to start, and the live feed
 * behind its slider. Pure types and helpers — no database, safe to import from the browser.
 */

/** The match events a visitor is told about the moment an operator records them. */
export const NOTABLE_EVENTS = [
  "goal",
  "penalty_goal",
  "own_goal",
  "penalty_missed",
  "yellow_card",
  "second_yellow",
  "red_card",
  "substitution",
] as const;
export type NotableEvent = (typeof NOTABLE_EVENTS)[number];

export const isNotableEvent = (type: string): type is NotableEvent => (NOTABLE_EVENTS as readonly string[]).includes(type);

/** Goals change the score, so they get the big celebration. */
export const isGoalEvent = (type: string) => type === "goal" || type === "penalty_goal" || type === "own_goal";

/** A match in play. Scores and minute are as of `LiveFeed.serverTime`. */
export type LiveMatch = {
  id: string;
  competitionId: string;
  competitionName: string;
  kuCode: string | null;
  homeShort: string | null;
  homeName: string | null;
  homeLogo: string | null;
  awayShort: string | null;
  awayName: string | null;
  awayLogo: string | null;
  homeScore: number;
  awayScore: number;
  status: "live" | "halftime";
  minute: number;
};

/** One thing an operator recorded during a live match. */
export type LiveEvent = {
  id: string;
  matchId: string;
  competitionId: string;
  competitionName: string;
  type: NotableEvent;
  minute: number;
  addedTime: number;
  playerName: string | null;
  clubShort: string | null;
  homeShort: string | null;
  awayShort: string | null;
  homeScore: number;
  awayScore: number;
  /** ISO time the operator recorded it. */
  createdAt: string;
};

export type LiveFeed = {
  /** ISO time the feed was read, so "how old is this event" never depends on the visitor's clock. */
  serverTime: string;
  matches: LiveMatch[];
  /** Recent events of the matches above, newest first. */
  events: LiveEvent[];
};

export type FeaturedState = "live" | "running" | "soon";

/** A tournament (Turnamen) on the home page slider. */
export type FeaturedTournament = {
  id: string;
  name: string;
  season: string;
  organizer: string | null;
  state: FeaturedState;
  liveMatches: number;
  kus: string[];
  clubs: number;
  played: number;
  total: number;
  /** YYYY-MM-DD of the earliest and latest KU dates. */
  startDate: string | null;
  endDate: string | null;
};

/** An event is only celebrated when it is this fresh; older ones (a tab left open) are skipped. */
export const FRESH_EVENT_SECONDS = 45;

export function eventAgeSeconds(event: Pick<LiveEvent, "createdAt">, serverTime: string) {
  return (new Date(serverTime).getTime() - new Date(event.createdAt).getTime()) / 1000;
}

/** "45'" or "90+3'" */
export function minuteLabel(e: Pick<LiveEvent, "minute" | "addedTime">) {
  return `${e.minute}${e.addedTime ? `+${e.addedTime}` : ""}′`;
}
