/**
 * Tint for an SSB that has no logo. SSBs no longer store team colours, so the
 * crest fallback is picked from the short code: the same SSB always gets the
 * same colour, and neighbours in a table usually differ. Pure — usable anywhere.
 */
const TINTS = [
  { bg: "#ffc93c", fg: "#141414" }, // yellow
  { bg: "#ffb3d9", fg: "#141414" }, // pink
  { bg: "#b6f0c2", fg: "#141414" }, // mint
  { bg: "#bdb4fb", fg: "#141414" }, // lavender
  { bg: "#4361ee", fg: "#ffffff" }, // blue
  { bg: "#d9f95e", fg: "#141414" }, // lime
  { bg: "#ff6b2c", fg: "#141414" }, // orange
  { bg: "#e4222d", fg: "#ffffff" }, // brand red
] as const;

export type CrestTint = (typeof TINTS)[number];

export function crestTint(seed?: string | null): CrestTint {
  const s = (seed ?? "").trim().toUpperCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}
