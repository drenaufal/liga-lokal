/**
 * Keuangan arithmetic. Pure functions only (no database, no React) so the same rules drive the
 * pages and scripts/test-finance.ts, which checks them against the totals in the original workbooks.
 */

export const sum = <T,>(rows: readonly T[], pick: (row: T) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

/** Share of a whole as a 0–1 fraction (0 when the whole is 0). */
export const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/* ── Registrasi ─────────────────────────────────────────────────────── */

export type RegistrationAmounts = { fee: number; dpAmount: number; finalAmount: number };
/** paid = lunas, partial = baru DP / belum lunas, unpaid = belum bayar sama sekali. */
export type RegistrationStatus = "paid" | "partial" | "unpaid";

export const registrationPaid = (r: RegistrationAmounts) => r.dpAmount + r.finalAmount;
export const registrationRemaining = (r: RegistrationAmounts) => Math.max(0, r.fee - registrationPaid(r));

export function registrationStatus(r: RegistrationAmounts): RegistrationStatus {
  const paid = registrationPaid(r);
  if (paid <= 0) return "unpaid";
  return paid >= r.fee ? "paid" : "partial";
}

/* ── Match fee ──────────────────────────────────────────────────────── */

export type MatchFeeAmounts = { matches: number; feePerMatch: number };
export const matchFeeAmount = (r: MatchFeeAmounts) => r.matches * r.feePerMatch;

export type WeekTotal = { week: number; matches: number; amount: number };

/** One entry per week 1…max(programWeeks, last recorded week); weeks nobody has paid yet are zero. */
export function matchFeeByWeek(
  rows: readonly (MatchFeeAmounts & { week: number })[],
  programWeeks: number,
): WeekTotal[] {
  const last = Math.max(programWeeks, ...rows.map((r) => r.week), 0);
  const weeks: WeekTotal[] = Array.from({ length: last }, (_, i) => ({ week: i + 1, matches: 0, amount: 0 }));
  for (const r of rows) {
    const w = weeks[r.week - 1];
    if (!w) continue;
    w.matches += r.matches;
    w.amount += matchFeeAmount(r);
  }
  return weeks;
}

/** Weeks that have at least one match recorded. */
export const playedWeeks = (rows: readonly { week: number; matches: number }[]) =>
  new Set(rows.filter((r) => r.matches > 0).map((r) => r.week)).size;

/* ── RAB ────────────────────────────────────────────────────────────── */

export type BudgetLine = {
  period: "weekly" | "monthly";
  category: string;
  categoryOrder: number;
  name: string;
  itemOrder: number;
  quantity: number;
  unitPrice: number;
};

export const budgetLineTotal = (line: Pick<BudgetLine, "quantity" | "unitPrice">) => line.quantity * line.unitPrice;

export type BudgetGroup<T extends BudgetLine> = {
  period: T["period"];
  category: string;
  categoryOrder: number;
  items: T[];
  subtotal: number;
};

/** Lines grouped per period and category, both in the order the unit entered them. */
export function groupBudget<T extends BudgetLine>(lines: readonly T[]) {
  const out: Record<"weekly" | "monthly", BudgetGroup<T>[]> = { weekly: [], monthly: [] };
  const sorted = [...lines].sort(
    (a, b) => a.categoryOrder - b.categoryOrder || a.category.localeCompare(b.category) || a.itemOrder - b.itemOrder,
  );
  for (const line of sorted) {
    const groups = out[line.period];
    let group = groups.find((g) => g.category === line.category);
    if (!group) {
      group = { period: line.period, category: line.category, categoryOrder: line.categoryOrder, items: [], subtotal: 0 };
      groups.push(group);
    }
    group.items.push(line);
    group.subtotal += budgetLineTotal(line);
  }
  return out;
}

export type BudgetTotals = {
  /** Weekly costs for one match week. */
  weeklyPerWeek: number;
  /** Weekly costs for the whole program (× program weeks). */
  weeklyProgram: number;
  /** Monthly (one-off) costs, counted once. */
  monthly: number;
  /** Estimasi OPEX = weeklyProgram + monthly. */
  total: number;
};

export function budgetTotals(lines: readonly BudgetLine[], programWeeks: number): BudgetTotals {
  const weeklyPerWeek = sum(lines.filter((l) => l.period === "weekly"), budgetLineTotal);
  const monthly = sum(lines.filter((l) => l.period === "monthly"), budgetLineTotal);
  const weeklyProgram = weeklyPerWeek * programWeeks;
  return { weeklyPerWeek, weeklyProgram, monthly, total: weeklyProgram + monthly };
}

/** What each category costs over the whole program (weekly categories × program weeks). */
export function budgetByCategory(lines: readonly BudgetLine[], programWeeks: number) {
  const groups = groupBudget(lines);
  const rows = [
    ...groups.weekly.map((g) => ({ category: g.category, period: "weekly" as const, amount: g.subtotal * programWeeks })),
    ...groups.monthly.map((g) => ({ category: g.category, period: "monthly" as const, amount: g.subtotal })),
  ];
  return rows.sort((a, b) => b.amount - a.amount);
}

/* ── Aset ───────────────────────────────────────────────────────────── */

/** Running total by purchase date; purchases on the same day are merged into one point. */
export function cumulativeByDate(rows: readonly { purchasedOn: string; amount: number }[]) {
  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.purchasedOn, (byDate.get(r.purchasedOn) ?? 0) + r.amount);
  let running = 0;
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount, cumulative: (running += amount) }));
}

/* ── Modal & Dividen ────────────────────────────────────────────────── */

export function capitalSummary(rows: readonly { amount: number; status: "outstanding" | "returned" }[]) {
  const total = sum(rows, (r) => r.amount);
  const returned = sum(rows.filter((r) => r.status === "returned"), (r) => r.amount);
  return { total, returned, outstanding: total - returned, returnedShare: share(returned, total) };
}

/** Each recipient's portion of `grandTotal` (the dividends of every unit, not just the visible ones). */
export function dividendShares<T extends { amount: number }>(rows: readonly T[], grandTotal: number) {
  return rows.map((row) => ({ row, share: share(row.amount, grandTotal) }));
}

/* ── Ringkasan ──────────────────────────────────────────────────────── */

export type UnitFigures = {
  capital: ReturnType<typeof capitalSummary> & { count: number };
  assets: { total: number; count: number; withProof: number };
  registration: { billed: number; received: number; remaining: number; clubs: number; paidClubs: number };
  matchFee: { amount: number; matches: number; weeksPlayed: number };
  budget: BudgetTotals & { lines: number };
  dividends: { total: number; count: number };
  /** Everything received from clubs: registration payments + match fees. */
  income: number;
  /** Income as a share of the budget (can exceed 1). */
  budgetCoverage: number;
};

export type UnitDataset = {
  programWeeks: number;
  assets: { amount: number; proofUrl: string | null }[];
  capital: { amount: number; status: "outstanding" | "returned" }[];
  dividends: { amount: number }[];
  registrations: RegistrationAmounts[];
  matchFees: (MatchFeeAmounts & { week: number })[];
  budget: BudgetLine[];
};

export function unitFigures(data: UnitDataset): UnitFigures {
  const capital = capitalSummary(data.capital);
  const received = sum(data.registrations, registrationPaid);
  const billed = sum(data.registrations, (r) => r.fee);
  const matchFeeTotal = sum(data.matchFees, matchFeeAmount);
  const budget = budgetTotals(data.budget, data.programWeeks);
  const income = received + matchFeeTotal;
  return {
    capital: { ...capital, count: data.capital.length },
    assets: {
      total: sum(data.assets, (a) => a.amount),
      count: data.assets.length,
      withProof: data.assets.filter((a) => !!a.proofUrl).length,
    },
    registration: {
      billed,
      received,
      remaining: Math.max(0, billed - received),
      clubs: data.registrations.length,
      paidClubs: data.registrations.filter((r) => registrationStatus(r) === "paid").length,
    },
    matchFee: {
      amount: matchFeeTotal,
      matches: sum(data.matchFees, (m) => m.matches),
      weeksPlayed: playedWeeks(data.matchFees),
    },
    budget: { ...budget, lines: data.budget.length },
    dividends: { total: sum(data.dividends, (d) => d.amount), count: data.dividends.length },
    income,
    budgetCoverage: share(income, budget.total),
  };
}

/** Adds up the figures of several units (the "all units" summary). */
export function combineFigures(all: readonly UnitFigures[]): UnitFigures {
  const capitalTotal = sum(all, (f) => f.capital.total);
  const returned = sum(all, (f) => f.capital.returned);
  const billed = sum(all, (f) => f.registration.billed);
  const received = sum(all, (f) => f.registration.received);
  const matchFee = sum(all, (f) => f.matchFee.amount);
  const budgetTotal = sum(all, (f) => f.budget.total);
  const income = received + matchFee;
  return {
    capital: {
      total: capitalTotal,
      returned,
      outstanding: capitalTotal - returned,
      returnedShare: share(returned, capitalTotal),
      count: sum(all, (f) => f.capital.count),
    },
    assets: {
      total: sum(all, (f) => f.assets.total),
      count: sum(all, (f) => f.assets.count),
      withProof: sum(all, (f) => f.assets.withProof),
    },
    registration: {
      billed,
      received,
      remaining: Math.max(0, billed - received),
      clubs: sum(all, (f) => f.registration.clubs),
      paidClubs: sum(all, (f) => f.registration.paidClubs),
    },
    matchFee: {
      amount: matchFee,
      matches: sum(all, (f) => f.matchFee.matches),
      weeksPlayed: Math.max(0, ...all.map((f) => f.matchFee.weeksPlayed)),
    },
    budget: {
      weeklyPerWeek: sum(all, (f) => f.budget.weeklyPerWeek),
      weeklyProgram: sum(all, (f) => f.budget.weeklyProgram),
      monthly: sum(all, (f) => f.budget.monthly),
      total: budgetTotal,
      lines: sum(all, (f) => f.budget.lines),
    },
    dividends: { total: sum(all, (f) => f.dividends.total), count: sum(all, (f) => f.dividends.count) },
    income,
    budgetCoverage: share(income, budgetTotal),
  };
}
