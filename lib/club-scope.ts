import { eq, inArray, or, type AnyColumn, type SQL } from "drizzle-orm";
import { coaches, matches, players } from "@/lib/db/schema";

/**
 * Pure helpers for "an account only sees the SSB it looks after". The scope itself — `null`
 * (every SSB) or a list of SSB ids — is resolved per request by `getClubScope()` in
 * lib/auth/session.ts; queries take it as a plain argument, so they stay usable from scripts.
 */

/** The SSB(s) of one coach: the primary one first, then the second, without gaps or repeats. */
export function coachClubIds(c: { clubId?: string | null; secondClubId?: string | null }): string[] {
  return [...new Set([c.clubId, c.secondClubId].filter((id): id is string => !!id))];
}

/** Matches a coach who looks after `clubId` as their primary or second SSB. */
export function coachOfClub(clubId: string): SQL {
  return or(eq(coaches.clubId, clubId), eq(coaches.secondClubId, clubId))!;
}

/** Placeholder id that matches no row, for a restricted account that has no SSB at all. */
const NO_CLUB = "00000000-0000-0000-0000-000000000000";
const idsOf = (scope: string[]) => (scope.length ? scope : [NO_CLUB]);

/** `WHERE club column IN scope`, or `undefined` (no condition) when every SSB is allowed. */
export function clubScopeFilter(column: AnyColumn, scope: string[] | null): SQL | undefined {
  return scope ? inArray(column, idsOf(scope)) : undefined;
}

/** Players registered with an SSB in the scope, as their primary or second club. */
export function playerScopeFilter(scope: string[] | null): SQL | undefined {
  return scope ? or(inArray(players.clubId, idsOf(scope)), inArray(players.secondClubId, idsOf(scope))) : undefined;
}

/** Coaches who look after an SSB in the scope, as their primary or second club. */
export function coachScopeFilter(scope: string[] | null): SQL | undefined {
  return scope ? or(inArray(coaches.clubId, idsOf(scope)), inArray(coaches.secondClubId, idsOf(scope))) : undefined;
}

/** Matches with at least one side in the scope. */
export function matchScopeFilter(scope: string[] | null): SQL | undefined {
  return scope ? or(inArray(matches.homeClubId, idsOf(scope)), inArray(matches.awayClubId, idsOf(scope))) : undefined;
}

/** Is this record's club inside the scope? Records without a club are visible to nobody restricted. */
export function inClubScope(scope: string[] | null, ...clubIds: (string | null | undefined)[]): boolean {
  return scope === null || clubIds.some((id) => !!id && scope.includes(id));
}
