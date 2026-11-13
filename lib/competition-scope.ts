import { inArray, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * Pure helpers for "an operator only sees the Turnamen assigned to them". The scope itself —
 * `null` (every Turnamen) or a list of `competitions.id` — is resolved per request by
 * `getCompetitionScope()` in lib/auth/session.ts; queries take it as a plain argument.
 * It sits next to the SSB scope in lib/club-scope.ts and works the same way.
 */

/** Placeholder id that matches no row, for an operator who has no Turnamen assigned yet. */
const NO_COMPETITION = "00000000-0000-0000-0000-000000000000";

/** `WHERE competition column IN scope`, or `undefined` (no condition) when every Turnamen is allowed. */
export function competitionScopeFilter(column: AnyColumn, scope: string[] | null): SQL | undefined {
  return scope ? inArray(column, scope.length ? scope : [NO_COMPETITION]) : undefined;
}

/** Is this Turnamen inside the scope? */
export function inCompetitionScope(scope: string[] | null, competitionId: string | null | undefined): boolean {
  return scope === null || (!!competitionId && scope.includes(competitionId));
}
