import { eq, inArray } from "drizzle-orm";
import type { AnyMySqlColumn, MySqlTable } from "drizzle-orm/mysql-core";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { hashPassword } from "@/lib/auth/password";
import * as s from "@/lib/db/schema";
import {
  SEED_ASSETS,
  SEED_BUDGET,
  SEED_CAPITAL,
  SEED_DIVIDENDS,
  SEED_MATCH_FEES,
  SEED_REGISTRATIONS,
  SEED_UNITS,
  SHARED_DATA_UNIT,
} from "./seed-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = MySql2Database<any>;

/** Every ledger table has a primary key and the unit it belongs to. */
type LedgerTable = MySqlTable & { id: AnyMySqlColumn; businessUnitId: AnyMySqlColumn };

export type FinanceSeedOptions = {
  /** Report what would happen, write nothing. */
  dryRun?: boolean;
  /** Delete the seeded units' existing rows first and load the workbook data again. */
  reset?: boolean;
  /** When set, also creates one login per unit (`<code>@ligalokal.id`) with this password. */
  accountPassword?: string;
};

export type FinanceSeedReport = {
  dryRun: boolean;
  units: { code: string; id: string; created: boolean }[];
  tables: { table: string; unit: string; action: "inserted" | "replaced" | "skipped"; rows: number; existing: number }[];
  accounts: { email: string; unit: string; created: boolean }[];
};

/**
 * Loads the six workbooks (lib/finance/seed-data.ts) into the Keuangan tables.
 *
 * Additive and re-runnable: a table that already holds rows for a unit is left alone, so data the
 * units typed in themselves is never overwritten. `reset` replaces just the seeded units' rows.
 * It never touches any other table (unlike `npm run db:seed`, which truncates everything).
 */
export async function seedFinance(db: AnyDb, options: FinanceSeedOptions = {}): Promise<FinanceSeedReport> {
  const dryRun = !!options.dryRun;
  const report: FinanceSeedReport = { dryRun, units: [], tables: [], accounts: [] };

  /* ── units ── */
  const idByCode = new Map<string, string>();
  for (const unit of SEED_UNITS) {
    const [found] = await db.select({ id: s.businessUnits.id }).from(s.businessUnits).where(eq(s.businessUnits.code, unit.code));
    const id = found?.id ?? crypto.randomUUID();
    if (!found && !dryRun) {
      await db.insert(s.businessUnits).values({ id, code: unit.code, name: unit.name, description: unit.description, programWeeks: 10 });
    }
    idByCode.set(unit.code, id);
    report.units.push({ code: unit.code, id, created: !found });
  }
  const unitId = (code: string) => {
    const id = idByCode.get(code);
    if (!id) throw new Error(`Seed refers to unknown unit ${code}`);
    return id;
  };

  /* ── ledger tables ── */
  async function load(name: string, table: LedgerTable, byUnit: Map<string, never[]>) {
    for (const [code, rows] of byUnit) {
      const id = unitId(code);
      const col = table.businessUnitId;
      const existing = report.units.find((u) => u.code === code)?.created ? [] : await db.select({ id: table.id }).from(table).where(eq(col, id));
      if (existing.length && !options.reset) {
        report.tables.push({ table: name, unit: code, action: "skipped", rows: 0, existing: existing.length });
        continue;
      }
      if (!dryRun) {
        if (existing.length) await db.delete(table).where(eq(col, id));
        await db.insert(table).values(rows.map((row: object) => ({ id: crypto.randomUUID(), businessUnitId: id, ...row })) as never);
      }
      report.tables.push({ table: name, unit: code, action: existing.length ? "replaced" : "inserted", rows: rows.length, existing: existing.length });
    }
  }

  const group = <R extends { unit: string }>(rows: R[], map: (row: R) => object) => {
    const out = new Map<string, object[]>();
    for (const row of rows) out.set(row.unit, [...(out.get(row.unit) ?? []), map(row)]);
    return out as Map<string, never[]>;
  };
  const shared = <R,>(rows: R[], map: (row: R) => object) => new Map<string, never[]>([[SHARED_DATA_UNIT, rows.map(map) as never[]]]);

  await load("fin_assets", s.finAssets, group(SEED_ASSETS, (r) => ({ purchasedOn: r.purchasedOn, name: r.name, amount: r.amount })));
  await load("fin_capital", s.finCapital, group(SEED_CAPITAL, (r) => ({ ownerName: r.owner, amount: r.amount, status: r.status })));
  await load("fin_dividends", s.finDividends, group(SEED_DIVIDENDS, (r) => ({ recipientName: r.recipient, amount: r.amount })));
  await load(
    "fin_registrations",
    s.finRegistrations,
    shared(SEED_REGISTRATIONS, (r) => ({ clubName: r.club, fee: r.fee, dpAmount: r.dp, finalAmount: r.final })),
  );
  await load(
    "fin_match_fees",
    s.finMatchFees,
    shared(SEED_MATCH_FEES, (r) => ({ clubName: r.club, week: r.week, matches: r.matches, feePerMatch: r.fee })),
  );
  await load(
    "fin_budget_items",
    s.finBudgetItems,
    shared(SEED_BUDGET, (r) => ({
      period: r.period,
      category: r.category,
      categoryOrder: r.categoryOrder,
      name: r.name,
      itemOrder: r.itemOrder,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
    })),
  );

  /* ── logins (only when a password is supplied) ── */
  if (options.accountPassword) {
    const passwordHash = dryRun ? "" : await hashPassword(options.accountPassword);
    for (const unit of SEED_UNITS) {
      const email = `${unit.code.toLowerCase()}@ligalokal.id`;
      const [found] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
      if (!found && !dryRun) {
        const id = crypto.randomUUID();
        await db.insert(s.users).values({
          id,
          name: `Unit ${unit.name}`,
          email,
          passwordHash,
          role: "unit_bisnis",
          title: `Unit Bisnis ${unit.name}`,
          active: true,
        });
        await db.insert(s.businessUnitMembers).values({ userId: id, businessUnitId: unitId(unit.code) });
      }
      report.accounts.push({ email, unit: unit.code, created: !found });
    }
  }

  // keep the lookup honest: every seeded unit really exists after a real run
  if (!dryRun) {
    const rows = await db.select({ code: s.businessUnits.code }).from(s.businessUnits).where(inArray(s.businessUnits.code, SEED_UNITS.map((u) => u.code)));
    if (rows.length !== SEED_UNITS.length) throw new Error("Finance seed: units missing after insert");
  }
  return report;
}
