import * as React from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessUnitMembers, businessUnits } from "@/lib/db/schema";
import { can, type AccessSubject } from "@/lib/auth/rbac";
import { NO_UNIT, effectiveUnit, type FinanceScope, type UnitFilter } from "./scope";

// `React.cache` only exists in the server build; scripts that import this file get the bare function.
const perRequest: <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => R =
  typeof React.cache === "function" ? React.cache : (fn) => fn;

let warned = false;
function warnOnce(error: unknown) {
  if (warned) return;
  warned = true;
  console.error("Keuangan tables unavailable (run `npm run db:migrate`)", error);
}

/** True once migration 0008 has been applied; the Keuangan pages show setup instructions until then. */
export async function financeReady(): Promise<boolean> {
  try {
    await db.select({ id: businessUnits.id }).from(businessUnits).limit(1);
    return true;
  } catch (error) {
    warnOnce(error);
    return false;
  }
}

const memberUnitId = perRequest(async (userId: string): Promise<string | null> => {
  try {
    const [row] = await db
      .select({ unitId: businessUnitMembers.businessUnitId })
      .from(businessUnitMembers)
      .where(eq(businessUnitMembers.userId, userId))
      .limit(1);
    return row?.unitId ?? null;
  } catch (error) {
    warnOnce(error);
    return null;
  }
});

/** Resolves what the signed-in person may see: every unit, or just the one their login belongs to. */
export async function getFinanceScope(user: { id: string } & Exclude<AccessSubject, string | null | undefined>): Promise<FinanceScope> {
  const allUnits = can(user, "finance:all-units");
  return { allUnits, unitId: allUnits ? null : await memberUnitId(user.id) };
}

export type UnitSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  programWeeks: number;
  active: boolean;
};

/** The units this person can pick from: all of them, or only their own. */
export async function listVisibleUnits(scope: FinanceScope): Promise<UnitSummary[]> {
  if (!scope.allUnits && !scope.unitId) return [];
  try {
    const rows = await db
      .select({
        id: businessUnits.id,
        code: businessUnits.code,
        name: businessUnits.name,
        description: businessUnits.description,
        programWeeks: businessUnits.programWeeks,
        active: businessUnits.active,
      })
      .from(businessUnits)
      .where(scope.allUnits ? undefined : eq(businessUnits.id, scope.unitId!))
      .orderBy(asc(businessUnits.name));
    return rows;
  } catch (error) {
    warnOnce(error);
    return [];
  }
}

export type FinanceContext = {
  scope: FinanceScope;
  /** Units the person can see (everything for admins, one for a unit login). */
  units: UnitSummary[];
  /** What data queries must be restricted to. */
  filter: UnitFilter;
  /** The single unit being shown, when exactly one is. */
  unit: UnitSummary | null;
  /** A login that belongs to no unit: there is nothing to show it. */
  noUnit: boolean;
};

/** Everything a Keuangan page needs to know about "whose data am I showing?" in one call. */
export async function resolveFinanceContext(
  user: { id: string } & Exclude<AccessSubject, string | null | undefined>,
  unitParam?: string | null,
): Promise<FinanceContext> {
  const scope = await getFinanceScope(user);
  const units = await listVisibleUnits(scope);
  const wanted = unitParam?.trim().toLowerCase();
  const requested = wanted ? units.find((u) => u.code.toLowerCase() === wanted) : undefined;
  // an unknown ?unit= falls back to "all units" for admins; a unit login ignores it anyway
  const filter = effectiveUnit(scope, requested?.id ?? null);
  const unit = filter && filter !== NO_UNIT ? (units.find((u) => u.id === filter) ?? null) : null;
  return { scope, units, filter, unit, noUnit: filter === NO_UNIT };
}
