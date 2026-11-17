/**
 * Who may see or write which unit's data. These rules are pure (no database) so they can be
 * tested on their own; lib/finance/access.ts looks up the person's unit and feeds them in.
 *
 *   - an account with `finance:all-units` sees every unit and may narrow the view with ?unit=
 *   - any other account is pinned to its own unit — a ?unit= value is ignored, never trusted
 *   - an account that is in no unit sees nothing
 */

export type FinanceScope = {
  /** Holds `finance:all-units`. */
  allUnits: boolean;
  /** The unit this login belongs to (null for accounts without one). */
  unitId: string | null;
};

/** `null` means "all units"; a string means exactly that unit; `NONE` means there is nothing to show. */
export const NO_UNIT = "__none__" as const;
export type UnitFilter = string | null | typeof NO_UNIT;

/** The unit the data queries must be restricted to for this person and request. */
export function effectiveUnit(scope: FinanceScope, requested: string | null | undefined): UnitFilter {
  if (scope.allUnits) return requested || null;
  return scope.unitId ?? NO_UNIT;
}

/** May this person create, change or delete a row that belongs to `unitId`? */
export function canTouchUnit(scope: FinanceScope, unitId: string | null | undefined): boolean {
  if (!unitId) return false;
  return scope.allUnits || scope.unitId === unitId;
}
