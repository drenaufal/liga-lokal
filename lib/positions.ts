/**
 * Player positions.
 *
 * The stored value is one of 13 specific roles. The four broad lines
 * (GK / DF / MF / FW) are derived from it and used wherever the app compares
 * "the same kind of player": peer percentiles, AI talent filters, roster order.
 *
 * Pure module (no imports) so the schema, server code and client components
 * can all share it.
 */

export const PLAYER_POSITIONS = [
  "GK",
  "CB",
  "RB",
  "LB",
  "WB",
  "DMF",
  "CMF",
  "AMF",
  "WF",
  "ST",
  "CF",
  "LW",
  "RW",
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];
export type PositionLine = "GK" | "DF" | "MF" | "FW";

export const POSITION_LINES: {
  line: PositionLine;
  label: string;
  roles: readonly PlayerPosition[];
}[] = [
  { line: "GK", label: "Kiper", roles: ["GK"] },
  { line: "DF", label: "Bertahan", roles: ["CB", "RB", "LB", "WB"] },
  { line: "MF", label: "Tengah", roles: ["DMF", "CMF", "AMF", "WF"] },
  { line: "FW", label: "Depan", roles: ["ST", "CF", "LW", "RW"] },
];

export const POSITION_NAME: Record<PlayerPosition, string> = {
  GK: "Kiper",
  CB: "Bek Tengah",
  RB: "Bek Kanan",
  LB: "Bek Kiri",
  WB: "Bek Sayap",
  DMF: "Gelandang Bertahan",
  CMF: "Gelandang Tengah",
  AMF: "Gelandang Serang",
  WF: "Gelandang Sayap",
  ST: "Striker",
  CF: "Penyerang Tengah",
  LW: "Sayap Kiri",
  RW: "Sayap Kanan",
};

export const LINE_LABEL: Record<PositionLine, string> = {
  GK: "Kiper",
  DF: "Bertahan",
  MF: "Tengah",
  FW: "Depan",
};

/** Display order of the lines on a team sheet. */
export const LINE_ORDER: Record<PositionLine, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

const LINE_OF = Object.fromEntries(
  POSITION_LINES.flatMap((l) => l.roles.map((r) => [r, l.line])),
) as Record<PlayerPosition, PositionLine>;

export function isPlayerPosition(v: unknown): v is PlayerPosition {
  return typeof v === "string" && (PLAYER_POSITIONS as readonly string[]).includes(v);
}

export function isPositionLine(v: unknown): v is PositionLine {
  return v === "GK" || v === "DF" || v === "MF" || v === "FW";
}

/** The broad line of a role. Line keys pass through; anything unknown counts as midfield. */
export function positionLine(pos: string | null | undefined): PositionLine {
  if (!pos) return "MF";
  if (isPlayerPosition(pos)) return LINE_OF[pos];
  if (isPositionLine(pos)) return pos;
  return "MF";
}

export function rolesOfLine(line: PositionLine): readonly PlayerPosition[] {
  return POSITION_LINES.find((l) => l.line === line)?.roles ?? [];
}

/**
 * A list-filter value — a specific role (`CB`) or a whole line (`DF`) — as the
 * stored roles it matches. Empty when the value is not recognised.
 */
export function expandPosition(value: string | null | undefined): PlayerPosition[] {
  if (!value) return [];
  if (isPositionLine(value)) return [...rolesOfLine(value)];
  if (isPlayerPosition(value)) return [value];
  return [];
}

/** Role an old four-way code (GK/DF/MF/FW) becomes when nothing more specific is known. */
export const LEGACY_DEFAULT_ROLE: Record<PositionLine, PlayerPosition> = {
  GK: "GK",
  DF: "CB",
  MF: "CMF",
  FW: "ST",
};

/** Roles spread over a squad when converting legacy data, so lines are not all one role. */
export const LEGACY_ROLE_SPREAD: Record<PositionLine, readonly PlayerPosition[]> = {
  GK: ["GK"],
  DF: ["CB", "RB", "CB", "LB", "CB", "WB"],
  MF: ["CMF", "DMF", "CMF", "AMF", "CMF", "WF"],
  FW: ["ST", "LW", "ST", "RW", "CF", "ST"],
};

/**
 * CSV / free-text position → role. Accepts the 13 roles in any case; the old
 * four-way codes map to their default role and are flagged `legacy` so the
 * caller can warn about it.
 */
export function parsePosition(raw: string | null | undefined): { role: PlayerPosition; legacy: boolean } | null {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return null;
  if (isPlayerPosition(v)) return { role: v, legacy: false };
  if (isPositionLine(v)) return { role: LEGACY_DEFAULT_ROLE[v], legacy: v !== "GK" };
  return null;
}

/** "CB · Bek Tengah". */
export function positionText(pos: string | null | undefined) {
  if (!pos) return "—";
  if (isPlayerPosition(pos)) return `${pos} · ${POSITION_NAME[pos]}`;
  if (isPositionLine(pos)) return LINE_LABEL[pos];
  return pos;
}
