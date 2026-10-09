/**
 * The eight one-tap buttons next to every player's name on the match page, in
 * the order the operators asked for. Pure, so both the page and the server
 * action can share it.
 */
export const QUICK_TYPES = [
  "goal",
  "assist",
  "shot_on",
  "save",
  "interception",
  "shot_off",
  "red_card",
  "yellow_card",
] as const;

export type QuickType = (typeof QUICK_TYPES)[number];
