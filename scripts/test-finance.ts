/**
 * Keuangan rules that need no database: the seed against the totals Excel computed in the original
 * workbooks, the arithmetic behind every table, input validation and who may see which unit.
 * Run with `npm run test:finance`.
 */
import {
  budgetByCategory,
  budgetLineTotal,
  budgetTotals,
  capitalSummary,
  combineFigures,
  cumulativeByDate,
  dividendShares,
  groupBudget,
  matchFeeAmount,
  matchFeeByWeek,
  playedWeeks,
  registrationPaid,
  registrationRemaining,
  registrationStatus,
  sum,
  unitFigures,
  type UnitDataset,
} from "@/lib/finance/calc";
import { NO_UNIT, canTouchUnit, effectiveUnit } from "@/lib/finance/scope";
import {
  ENTITIES,
  assetSchema,
  budgetSchema,
  capitalSchema,
  matchFeeSchema,
  moneyField,
  registrationSchema,
} from "@/lib/finance/entities";
import { makeEditUnitSchema, makeNewLoginSchema, makeNewUnitSchema } from "@/lib/finance/unit-schemas";
import {
  EXCEL_CONTROL_TOTALS as X,
  SEED_ASSETS,
  SEED_BUDGET,
  SEED_CAPITAL,
  SEED_DIVIDENDS,
  SEED_MATCH_FEES,
  SEED_REGISTRATIONS,
  SEED_UNITS,
  SHARED_DATA_UNIT,
} from "@/lib/finance/seed-data";
import { createT } from "@/lib/i18n/translate";
import { makeFormatters } from "@/lib/i18n/format";

let failures = 0;
const ok = (cond: unknown, label: string) => {
  if (!cond) failures++;
  console.log(`${cond ? "✓" : "✗"} ${label}`);
};
const eq = (actual: unknown, expected: unknown, label: string) => {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) console.log(`   expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  ok(same, label);
};

const t = createT("id", {});
const registrations = SEED_REGISTRATIONS.map((r) => ({ clubName: r.club, fee: r.fee, dpAmount: r.dp, finalAmount: r.final }));
const matchFees = SEED_MATCH_FEES.map((m) => ({ clubName: m.club, week: m.week, matches: m.matches, feePerMatch: m.fee }));

/* ── The seed reproduces the workbooks ── */
eq(sum(SEED_ASSETS, (a) => a.amount), X.assetsTotal, "ASET: total matches the workbook (5.3 jt)");
eq(sum(SEED_CAPITAL, (c) => c.amount), X.capitalTotal, "MODAL: total matches the workbook (60 jt)");
eq(sum(SEED_DIVIDENDS, (d) => d.amount), X.dividendTotal, "DEVIDEN: total matches the workbook cell B4 (100 jt)");
eq(sum(registrations, (r) => r.fee), X.registrationFee, "REGISTRASI: billed total matches cell C1 (17.5 jt)");
eq(sum(matchFees, (m) => m.matches), X.matchFeeMatches, "MATCH FEE: total matches matches cell AH1 (52)");
eq(sum(matchFees, matchFeeAmount), X.matchFeeAmount, "MATCH FEE: total amount matches cell AI1 (26 jt)");
const totals = budgetTotals(SEED_BUDGET, 10);
eq(totals.weeklyPerWeek, X.rabWeeklyPerWeek, "RAB: weekly per week matches cell E51");
eq(totals.weeklyProgram, X.rabWeeklyAll, "RAB: weekly × 10 weeks matches cell E52");
eq(totals.monthly, X.rabMonthly, "RAB: monthly total matches cell E92");
eq(totals.total, X.rabTotal, "RAB: total estimate matches cell E94 (265.2 jt)");

const weekly = groupBudget(SEED_BUDGET).weekly;
const monthly = groupBudget(SEED_BUDGET).monthly;
eq(weekly.length, 7, "RAB: seven weekly categories");
eq(monthly.length, 6, "RAB: six monthly categories");
eq(weekly.map((g) => g.subtotal), [4686000, 1400000, 10400000, 1700000, 400000, 1500000, 2530000], "RAB: weekly category subtotals match cells E4…E47");
eq(monthly.map((g) => g.subtotal), [5800000, 1640000, 28100000, 2000000, 1500000, 0], "RAB: monthly category subtotals match cells E57…E90");
eq(weekly.map((g) => g.category)[0], "Biaya Peralatan & Sarana Pertandingan", "RAB: categories keep the workbook order");
ok(SEED_BUDGET.every((b) => Number.isInteger(b.unitPrice) && b.unitPrice >= 0 && b.quantity >= 0), "RAB: every quantity and unit price is a whole, non-negative number");
ok(SEED_BUDGET.filter((b) => budgetLineTotal(b) === 0).length === 5, "RAB: the five zero-value lines (TV, gawang, tandu, keamanan, liputan) are kept");
ok(!SEED_BUDGET.some((b) => /@\s*\d/.test(b.name)), "RAB: no “@price” left in item names (unit price has its own column)");
eq(budgetByCategory(SEED_BUDGET, 10)[0], { category: "Biaya Panitia", period: "weekly", amount: 104000000 }, "RAB: biggest category over the program = Biaya Panitia (10.4 jt × 10)");

/* ── Seed structure ── */
eq(SEED_UNITS.map((u) => u.code), ["PARFUM", "KURSI"], "units come from MODAL: PARFUM and KURSI");
ok(SEED_ASSETS.every((a) => SEED_UNITS.some((u) => u.code === a.unit)), "every asset belongs to a known unit");
eq(sum(SEED_ASSETS.filter((a) => a.unit === "PARFUM"), (a) => a.amount), 3500000, "ASET: PARFUM bought 3.5 jt");
eq(sum(SEED_ASSETS.filter((a) => a.unit === "KURSI"), (a) => a.amount), 1800000, "ASET: KURSI bought 1.8 jt");
eq(SEED_DIVIDENDS.map((d) => [d.recipient, d.unit]), [["A", "PARFUM"], ["B", "KURSI"]], "DEVIDEN: recipients A/B follow their MODAL owners");
ok(SEED_UNITS.some((u) => u.code === SHARED_DATA_UNIT), "the unit that owns registrasi / match fee / RAB exists");
eq(new Set(matchFees.map((m) => `${m.clubName}|${m.week}`)).size, matchFees.length, "MATCH FEE: no club has two rows for the same week");
eq(new Set(registrations.map((r) => r.clubName.toLowerCase())).size, registrations.length, "REGISTRASI: club names are unique");

/* ── Registrasi ── */
ok(registrations.every((r) => registrationStatus(r) === "partial"), "REGISTRASI: all ten clubs have paid only the DP → “belum lunas”");
eq(sum(registrations, registrationPaid), 7500000, "REGISTRASI: 7.5 jt received (10 × 750 rb DP)");
eq(sum(registrations, registrationRemaining), 10000000, "REGISTRASI: 10 jt still to collect");
eq(registrationStatus({ fee: 1750000, dpAmount: 750000, finalAmount: 1000000 }), "paid", "REGISTRASI: DP + final = fee → lunas");
eq(registrationStatus({ fee: 1750000, dpAmount: 0, finalAmount: 0 }), "unpaid", "REGISTRASI: nothing paid → belum bayar");
eq(registrationRemaining({ fee: 100, dpAmount: 80, finalAmount: 40 }), 0, "REGISTRASI: remaining never goes negative");

/* ── Match fee ── */
const weeks = matchFeeByWeek(matchFees, 10);
eq(weeks.length, 10, "MATCH FEE: ten weekly columns");
eq(weeks.slice(0, 3).map((w) => [w.matches, w.amount]), [[18, 9000000], [16, 8000000], [18, 9000000]], "MATCH FEE: weeks 1–3 match the workbook totals (D1/G1/J1, E1/H1/K1)");
ok(weeks.slice(3).every((w) => w.matches === 0 && w.amount === 0), "MATCH FEE: weeks 4–10 are empty, not missing");
eq(playedWeeks(matchFees), 3, "MATCH FEE: three weeks played");
eq(matchFeeByWeek([{ week: 12, matches: 1, feePerMatch: 5 }], 10).length, 12, "MATCH FEE: a week beyond the program still gets its column");

/* ── Modal, dividen, aset ── */
const cap = capitalSummary(SEED_CAPITAL);
eq([cap.total, cap.returned, cap.outstanding], [60000000, 50000000, 10000000], "MODAL: 50 jt returned, 10 jt outstanding");
ok(Math.abs(cap.returnedShare - 50 / 60) < 1e-9, "MODAL: 83.3% returned");
eq(dividendShares(SEED_DIVIDENDS, X.dividendTotal).map((s) => s.share), [0.7, 0.3], "DEVIDEN: portions 70% / 30% (workbook column CONT)");
eq(dividendShares([{ amount: 70 }], 100)[0].share, 0.7, "DEVIDEN: a unit login still sees 70%, measured against all units");
eq(cumulativeByDate(SEED_ASSETS).map((p) => p.cumulative), [1000000, 3900000, 4800000, 5300000], "ASET: running total by purchase date");
eq(cumulativeByDate(SEED_ASSETS).map((p) => p.date), ["2026-10-04", "2026-10-07", "2026-10-13", "2026-10-14"], "ASET: two purchases on 7 Oct share one point");

/* ── Summary figures ── */
const dataset = (unit: string): UnitDataset => ({
  programWeeks: 10,
  assets: SEED_ASSETS.filter((a) => a.unit === unit).map((a) => ({ amount: a.amount, proofUrl: null })),
  capital: SEED_CAPITAL.filter((c) => c.unit === unit),
  dividends: SEED_DIVIDENDS.filter((d) => d.unit === unit),
  registrations: unit === SHARED_DATA_UNIT ? registrations : [],
  matchFees: unit === SHARED_DATA_UNIT ? matchFees : [],
  budget: unit === SHARED_DATA_UNIT ? SEED_BUDGET : [],
});
const parfum = unitFigures(dataset("PARFUM"));
const kursi = unitFigures(dataset("KURSI"));
eq([parfum.capital.total, parfum.assets.total, parfum.income, parfum.budget.total, parfum.dividends.total], [50000000, 3500000, 33500000, 265200000, 70000000], "PARFUM summary");
eq([kursi.capital.total, kursi.assets.total, kursi.income, kursi.budget.total, kursi.dividends.total], [10000000, 1800000, 0, 0, 30000000], "KURSI summary: only what is filed under it");
ok(Math.abs(parfum.budgetCoverage - 33500000 / 265200000) < 1e-12, "PARFUM: income covers 12.6% of the budget");
eq(kursi.budgetCoverage, 0, "KURSI: no budget → coverage 0, not NaN");
const all = combineFigures([parfum, kursi]);
eq([all.capital.total, all.assets.total, all.income, all.budget.total, all.dividends.total], [60000000, 5300000, 33500000, 265200000, 100000000], "all units = the workbook totals");
eq([all.capital.returned, all.capital.outstanding], [50000000, 10000000], "all units: capital split");
eq(all.registration.remaining, 10000000, "all units: registration remaining");

/* ── Who sees which unit ── */
const admin = { allUnits: true, unitId: null };
const parfumLogin = { allUnits: false, unitId: "u-parfum" };
const orphan = { allUnits: false, unitId: null };
eq(effectiveUnit(admin, null), null, "admin without a filter sees all units");
eq(effectiveUnit(admin, "u-kursi"), "u-kursi", "admin with a filter sees just that unit");
eq(effectiveUnit(parfumLogin, null), "u-parfum", "a unit login is pinned to its own unit");
eq(effectiveUnit(parfumLogin, "u-kursi"), "u-parfum", "a unit login cannot widen the view with ?unit=");
eq(effectiveUnit(orphan, null), NO_UNIT, "a login in no unit sees nothing");
eq(effectiveUnit(orphan, "u-kursi"), NO_UNIT, "…whatever ?unit= says");
ok(canTouchUnit(admin, "u-kursi") && canTouchUnit(parfumLogin, "u-parfum"), "admin may write any unit; a unit login its own");
ok(!canTouchUnit(parfumLogin, "u-kursi") && !canTouchUnit(orphan, "u-parfum") && !canTouchUnit(admin, null), "a unit login cannot write another unit's rows; nobody writes to “no unit”");

/* ── Input validation ── */
const date = "2026-10-22";
ok(assetSchema(t).safeParse({ purchasedOn: date, name: "Sound Sistem", amount: "2000000", proofUrl: "", note: "" }).success, "asset: plain digits are accepted");
eq((assetSchema(t).parse({ purchasedOn: date, name: "X", amount: "Rp 2.000.000", proofUrl: "", note: "" }) as { amount: number }).amount, 2000000, "asset: “Rp 2.000.000” is read as 2000000");
ok(!assetSchema(t).safeParse({ purchasedOn: date, name: "X", amount: "", proofUrl: "", note: "" }).success, "asset: amount is required");
ok(!assetSchema(t).safeParse({ purchasedOn: date, name: "X", amount: "99999999999999", proofUrl: "", note: "" }).success, "asset: an absurd amount is refused");
ok(!assetSchema(t).safeParse({ purchasedOn: "2026-02-31", name: "X", amount: "1", proofUrl: "", note: "" }).success, "asset: 31 February is not a date");
ok(!assetSchema(t).safeParse({ purchasedOn: date, name: "  ", amount: "1", proofUrl: "", note: "" }).success, "asset: a blank name is refused");
ok(!assetSchema(t).safeParse({ purchasedOn: date, name: "X", amount: "1", proofUrl: "https://evil.example/x.png", note: "" }).success, "asset: a receipt must be one of our own uploads, not an arbitrary URL");
ok(moneyField(t).safeParse("0").success, "money: zero is allowed (a zero-value budget line)");
ok(capitalSchema(t).safeParse({ ownerName: "A", amount: "50000000", status: "returned", investedOn: "", returnedOn: "", note: "" }).success, "capital: optional dates may be empty");
ok(!capitalSchema(t).safeParse({ ownerName: "A", amount: "1", status: "gone", investedOn: "", returnedOn: "", note: "" }).success, "capital: unknown status refused");
const reg = (dp: string, fin: string) => registrationSchema(t).safeParse({ clubName: "CYSSS", fee: "1750000", dpAmount: dp, finalAmount: fin, dpPaidOn: "", finalPaidOn: "", dpProofUrl: "", finalProofUrl: "", note: "" });
ok(reg("750000", "").success, "registration: DP only (final left blank = 0)");
ok(reg("750000", "1000000").success, "registration: DP + final = fee");
ok(!reg("750000", "1000001").success, "registration: paying more than the fee is refused");
const mf = (week: string, matches: string) => matchFeeSchema(t).safeParse({ clubName: "Maesa", week, matches, feePerMatch: "500000", proofUrl: "", note: "" });
ok(mf("1", "2").success && mf("52", "0").success, "match fee: week 1–52, 0 or more matches");
ok(!mf("0", "2").success && !mf("53", "2").success && !mf("1", "-1").success && !mf("1.5", "2").success, "match fee: week and matches out of range are refused");
ok(budgetSchema(t).safeParse({ period: "monthly", category: "Biaya Hadiah", name: "Medali", quantity: "160", unitPrice: "35000", note: "" }).success, "budget: a normal line");
ok(!budgetSchema(t).safeParse({ period: "yearly", category: "x", name: "y", quantity: "1", unitPrice: "1", note: "" }).success, "budget: only weekly / monthly");
ok(Object.keys(ENTITIES).length === 6, "six kinds of data, one per workbook");
ok(ENTITIES.registration.proofs.length === 2 && ENTITIES.asset.proofs.length === 1 && ENTITIES.budget.proofs.length === 0, "receipt columns match the workbooks (aset 1, registrasi DP+lunas, match fee 1)");

/* ── Units & logins ── */
ok(makeNewUnitSchema(t).safeParse({ code: "parfum", name: "Parfum", description: "", programWeeks: "10" }).success, "unit: code is upper-cased");
eq((makeNewUnitSchema(t).parse({ code: "kursi", name: "Kursi", description: "", programWeeks: "10" })).code, "KURSI", "unit: “kursi” → KURSI");
ok(!makeNewUnitSchema(t).safeParse({ code: "has space", name: "X", description: "", programWeeks: "10" }).success, "unit: code without spaces");
ok(!makeNewUnitSchema(t).safeParse({ code: "OK", name: "Okay", description: "", programWeeks: "0" }).success, "unit: program weeks 1–52");
ok(makeEditUnitSchema(t).safeParse({ name: "Parfum", description: "", programWeeks: "12", active: true }).success, "unit: editing needs no code");
ok(!makeNewLoginSchema(t).safeParse({ name: "Unit", email: "nope", password: "12345678" }).success, "login: email must be an email");
ok(!makeNewLoginSchema(t).safeParse({ name: "Unit", email: "a@b.id", password: "short" }).success, "login: password at least 8 characters");

/* ── Formatting ── */
const id = makeFormatters("id");
const en = makeFormatters("en");
const plain = (s: string) => s.replace(/ /g, " "); // Intl uses non-breaking spaces
eq(plain(id.rupiah(1750000)), "Rp 1.750.000", "format: Rupiah, Indonesian grouping");
eq(plain(id.rupiahCompact(265200000)), "Rp 265,2 jt", "format: compact Rupiah in Indonesian (jt)");
eq(plain(en.rupiahCompact(265200000)), "Rp 265.2M", "format: compact Rupiah in English");
eq(plain(id.rupiahCompact(750000)), "Rp 750 rb", "format: ribu");
eq(plain(id.rupiahCompact(999999)), "Rp 1 jt", "format: 999.999 rolls over to 1 jt, not “1.000 rb”");
eq(plain(id.rupiahCompact(1500)), "Rp 1,5 rb", "format: decimals use the locale separator");
eq([plain(id.rupiahCompact(0)), plain(id.rupiahCompact(999))], ["Rp 0", "Rp 999"], "format: small amounts are written in full");
eq(plain(id.rupiahCompact(-2500000)), "Rp -2,5 jt", "format: negative amounts keep the sign");
eq(plain(en.rupiahCompact(1250000000)), "Rp 1.25B", "format: billions in English");
eq(plain(id.rupiahCompact(1250000000)), "Rp 1,25 M", "format: miliar in Indonesian");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll finance checks passed");
process.exit(failures ? 1 : 0);
