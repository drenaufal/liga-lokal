import { asc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { db } from "@/lib/db";
import {
  businessUnitMembers,
  businessUnits,
  finAssets,
  finBudgetItems,
  finCapital,
  finDividends,
  finMatchFees,
  finRegistrations,
} from "@/lib/db/schema";
import { NO_UNIT, type UnitFilter } from "./scope";
import type { UnitDataset } from "./calc";

/** Restricts a query to one unit; the NO_UNIT sentinel yields no rows at all. */
function inUnit(column: AnyMySqlColumn, filter: UnitFilter): SQL | undefined {
  if (filter === NO_UNIT) return sql`1 = 0`;
  return filter ? eq(column, filter) : undefined;
}

const unitCols = { unitCode: businessUnits.code, unitName: businessUnits.name };
const joinUnit = (column: AnyMySqlColumn) => eq(businessUnits.id, column);

export async function listAssets(filter: UnitFilter) {
  return db
    .select({ ...getTableColumns(finAssets), ...unitCols })
    .from(finAssets)
    .innerJoin(businessUnits, joinUnit(finAssets.businessUnitId))
    .where(inUnit(finAssets.businessUnitId, filter))
    .orderBy(asc(finAssets.purchasedOn), asc(finAssets.createdAt));
}

export async function listCapital(filter: UnitFilter) {
  return db
    .select({ ...getTableColumns(finCapital), ...unitCols })
    .from(finCapital)
    .innerJoin(businessUnits, joinUnit(finCapital.businessUnitId))
    .where(inUnit(finCapital.businessUnitId, filter))
    .orderBy(asc(businessUnits.name), asc(finCapital.createdAt));
}

export async function listDividends(filter: UnitFilter) {
  return db
    .select({ ...getTableColumns(finDividends), ...unitCols })
    .from(finDividends)
    .innerJoin(businessUnits, joinUnit(finDividends.businessUnitId))
    .where(inUnit(finDividends.businessUnitId, filter))
    .orderBy(asc(businessUnits.name), asc(finDividends.createdAt));
}

export async function listRegistrations(filter: UnitFilter) {
  return db
    .select({ ...getTableColumns(finRegistrations), ...unitCols })
    .from(finRegistrations)
    .innerJoin(businessUnits, joinUnit(finRegistrations.businessUnitId))
    .where(inUnit(finRegistrations.businessUnitId, filter))
    .orderBy(asc(businessUnits.name), asc(finRegistrations.clubName));
}

export async function listMatchFees(filter: UnitFilter) {
  return db
    .select({ ...getTableColumns(finMatchFees), ...unitCols })
    .from(finMatchFees)
    .innerJoin(businessUnits, joinUnit(finMatchFees.businessUnitId))
    .where(inUnit(finMatchFees.businessUnitId, filter))
    .orderBy(asc(businessUnits.name), asc(finMatchFees.week), asc(finMatchFees.createdAt));
}

export async function listBudgetItems(filter: UnitFilter) {
  return db
    .select({ ...getTableColumns(finBudgetItems), ...unitCols })
    .from(finBudgetItems)
    .innerJoin(businessUnits, joinUnit(finBudgetItems.businessUnitId))
    .where(inUnit(finBudgetItems.businessUnitId, filter))
    .orderBy(
      asc(businessUnits.name),
      asc(finBudgetItems.period),
      asc(finBudgetItems.categoryOrder),
      asc(finBudgetItems.itemOrder),
      asc(finBudgetItems.createdAt),
    );
}

/** Dividends of every unit. Only used as the denominator of each recipient's portion — never listed. */
export async function dividendGrandTotal(): Promise<number> {
  const [row] = await db.select({ total: sql<string>`coalesce(sum(${finDividends.amount}), 0)` }).from(finDividends);
  return Number(row?.total ?? 0);
}

/** Existing budget categories of a unit (to suggest names in the form). */
export async function budgetCategories(filter: UnitFilter) {
  const rows = await db
    .selectDistinct({ category: finBudgetItems.category, period: finBudgetItems.period, order: finBudgetItems.categoryOrder })
    .from(finBudgetItems)
    .where(inUnit(finBudgetItems.businessUnitId, filter))
    .orderBy(asc(finBudgetItems.period), asc(finBudgetItems.categoryOrder));
  return rows;
}

export type UnitRef = { id: string; code: string; name: string; programWeeks: number };

/** All six data sets of every unit in the filter, grouped per unit, for the summary page. */
export async function getUnitDatasets<U extends UnitRef>(units: readonly U[], filter: UnitFilter) {
  const [assets, capital, dividends, registrations, matchFees, budget] = await Promise.all([
    listAssets(filter),
    listCapital(filter),
    listDividends(filter),
    listRegistrations(filter),
    listMatchFees(filter),
    listBudgetItems(filter),
  ]);
  const visible = filter && filter !== NO_UNIT ? units.filter((u) => u.id === filter) : units;
  return visible.map((unit) => {
    const mine = <T extends { businessUnitId: string }>(rows: T[]) => rows.filter((r) => r.businessUnitId === unit.id);
    const dataset: UnitDataset = {
      programWeeks: unit.programWeeks,
      assets: mine(assets),
      capital: mine(capital),
      dividends: mine(dividends),
      registrations: mine(registrations),
      matchFees: mine(matchFees),
      budget: mine(budget),
    };
    return { unit, dataset, matchFees: mine(matchFees), assets: mine(assets) };
  });
}

/** Number of logins per unit (for the unit management table). */
export async function loginCountsByUnit() {
  const rows = await db
    .select({ unitId: businessUnitMembers.businessUnitId, n: sql<number>`count(*)` })
    .from(businessUnitMembers)
    .groupBy(businessUnitMembers.businessUnitId);
  return new Map(rows.map((r) => [r.unitId, Number(r.n)]));
}
