# Keuangan — financial monitoring per business unit

Module `/keuangan` (menu **Keuangan**). Each **Unit Bisnis** keeps six kinds of financial records; a unit's own login
sees and fills in only its unit, an administrator sees every unit and can filter by one. UI is Bahasa Indonesia with an
English catalog (`lib/i18n/messages/finance.ts`).

## 1. The six workbooks → six tables

Source: `documents/Buku-besar/*.xlsx`. `lib/finance/seed-data.ts` was generated from them by script, so no figure was retyped.

| Workbook | Table | Page | One row is | Receipt ("Upload bukti struk disini") |
|---|---|---|---|---|
| `ASET.xlsx` | `fin_assets` | `/keuangan/aset` | one purchase (date, item, amount) | `proof_url` |
| `MODAL.xlsx` | `fin_capital` | `/keuangan/modal` | one capital contribution + "sudah / belum kembali" | — |
| `DEVIDEN.xlsx` | `fin_dividends` | `/keuangan/dividen` | one recipient's dividend (portion % is computed) | — |
| `UANG MASUK REGISTRASI.xlsx` | `fin_registrations` | `/keuangan/registrasi` | one club: fee, DP, pelunasan | `dp_proof_url`, `final_proof_url` |
| `UANG MASUK MATCH FEE.xlsx` | `fin_match_fees` | `/keuangan/match-fee` | one club in one week: matches × fee per match | `proof_url` |
| `RAB.xlsx` | `fin_budget_items` | `/keuangan/rab` | one budget line: category, quantity, unit price | — |

Plus `business_units` and `business_unit_members` (which login belongs to which unit). Every ledger row has a `business_unit_id`.
Migration: `drizzle/0008_keuangan.sql` — additive (new tables, one extra value in the role enums), nothing is dropped.
The user ↔ unit link is its own table on purpose: `users` is untouched, so the app keeps working on a database that has not been migrated yet.

## 2. Reading the workbooks — decisions you should know about

1. **Units.** The only unit names in the workbooks are `PARFUM` (owner A) and `KURSI` (owner B), taken from MODAL/ASET. They are seeded as the first two units.
2. **Dividends** have no unit column; recipients `A` / `B` are matched to the unit whose MODAL owner has that name.
3. **Registrasi, match fee and RAB have no "Unit Bisnis" column.** The seed has to give them an owner: `SHARED_DATA_UNIT = "PARFUM"` in
   `lib/finance/seed-data.ts`. Change that one constant (and re-seed with `--reset`) to hand them to another unit. **Please confirm which unit they belong to.**
4. RAB column "BIAYA SATUAN" actually holds each line's **total** (quantity × price). The app shows Jumlah × Harga satuan = Total, with the unit price derived
   from the workbook formulas (`=D34*20000`) or, for lump sums, total ÷ quantity.
5. RAB "Weekly" lines are multiplied by the program length (10 weeks, `business_units.program_weeks`); "Monthly" lines are counted once —
   exactly as the workbook's `TOTAL 10 WEEK` and `TOTAL ESTIMASI OPEX` cells do (265.200.000).
6. Match-fee amounts are treated as **money received** (the sheet is titled "UANG MASUK"); only weeks 1–3 have data, weeks 4–10 stay empty.
   Registration: all ten clubs paid the DP (750.000 of 1.750.000); pelunasan is empty.
7. Labels tidied, numbers untouched: `Keamanaan`→`Keamanan`, `Lain -Lain`→`Lain-Lain`, `Coller Box`→`Cooler Box`,
   `Juara Uang Hadiah Uang N @…`→`Hadiah Uang Juara N`, and the `@price` suffix was dropped from RAB names (the price has its own column).
   The monthly RAB numbering in the workbook skips 8 (1, 9, 10 …); the app numbers categories 1…n per section.
8. The five zero-value RAB lines (Penyewaan TV, Pembelian Gawang, Beli Tandu, Keamanan Internal, Liputan TV & Digital) are kept and flagged "Belum dianggarkan".

`npm run test:finance` checks the seed against the totals Excel itself computed (5,3 jt assets · 60 jt modal · 100 jt dividen · 17,5 jt registrasi ·
52 laga / 26 jt match fee · RAB 22.616.000 per week, 226.160.000 × 10, 39.040.000 monthly, 265.200.000 total) and every per-category subtotal.

## 3. Business units and logins

- Role **`unit_bisnis`** ("Unit Bisnis"). Default permissions: `finance:view` + `finance:input`. It cannot delete (`finance:delete`), see other units
  (`finance:all-units`) or manage units (`finance.units:manage`); the Super Admin can change this on Pengaturan → Hak Akses Peran.
- **Create a unit and its login:** Keuangan → *Unit Bisnis* → *Tambah unit bisnis* (name, code, program weeks, optional first login), or *Tambah akun login* on an
  existing unit. *Ubah akun login* (key icon) resets a password or deactivates a login. Only administrators see this tab.
- The unit code is used in links (`/keuangan?unit=PARFUM`) and cannot be changed afterwards. A unit with `program_weeks` = N gets N columns in the match-fee grid
  and multiplies weekly RAB by N.
- After signing in, a unit login lands on `/keuangan`. Its sidebar shows only Keuangan; any other route redirects back with an "akses ditolak" notice.
- **Enforcement is on the server**: every query takes the unit filter from `lib/finance/scope.ts`; a unit login's `?unit=` is ignored; every save/delete re-checks that
  the row belongs to the person's unit; receipts open only for the owning unit or an administrator (`lib/finance/proof.ts`, used by `/api/media/[id]`).

## 4. Rolling it out

The checked-out `.env.local` may point at the **production** database. Every command below runs against `DATABASE_URL` — each script prints the host first.

1. **Back up** the target database.
2. `npm run db:migrate` — applies `0008_keuangan.sql` (and `0007` if it is still pending). Until this runs, Keuangan shows "Modul Keuangan belum siap" and everything else is unaffected.
3. `npm run db:seed:finance` — loads the workbook data. Re-runnable: a table that already has rows for a unit is skipped; no other table is touched.
   Flags: `-- --dry-run` (report only), `-- --reset` (replace the seeded units' rows).
4. Logins: `FINANCE_UNIT_PASSWORD=… npm run db:seed:finance` also creates `parfum@ligalokal.id` and `kursi@ligalokal.id` with that password
   (only for accounts that do not exist yet). Rotate the passwords afterwards, or skip this and create logins in the Unit Bisnis tab.
5. The full demo reset `npm run db:seed` now also loads the finance data (and the unit logins when `FINANCE_UNIT_PASSWORD` is set). `lib/db/reset.ts` tolerates a database that has no finance tables yet.

## 5. How the numbers are calculated (`lib/finance/calc.ts`)

| Figure | Formula |
|---|---|
| Registrasi terbayar / sisa | DP + pelunasan / biaya − terbayar (never negative). Status: **Lunas** (≥ biaya), **Belum lunas** (> 0), **Belum bayar** (0) |
| Match fee (cell, row) | laga × tarif per laga; a week's total sums all clubs |
| Modal | total, sudah kembali (status `returned`), belum kembali |
| Dividen portion | recipient ÷ dividends of **all** units, so a unit login still sees "70%" (not "100%") without seeing other units' rows |
| RAB | line = jumlah × harga; weekly per week → × program weeks; monthly counted once; estimasi OPEX = both |
| Anggaran tertutup | uang masuk (registrasi diterima + match fee) ÷ estimasi OPEX |

No cash balance is derived: dividends, capital and RAB are different kinds of figures (actual vs plan) and subtracting them would mislead.

## 6. What the pages show

Every page: a "Cara membaca halaman ini" guide (open by default, remembers if closed), KPI tiles, charts, then the table with a one-line hint under each column header,
totals row, status badges with plain labels, and empty states that say what to do next. Match fee is a club × week grid (click a cell to correct it, "+" on an empty cell
to add); RAB is grouped by category with subtotals and a "Total estimasi OPEX" bar. The summary page links each tile to its table and, for administrators, adds a per-unit comparison.

## 7. Code map

- `lib/finance/` — `calc.ts` (pure arithmetic), `scope.ts` (pure who-sees-what), `access.ts` (unit lookup), `queries.ts`, `entities.ts` (validation per kind), `records.ts` (save/delete + audit),
  `units.ts` / `unit-schemas.ts`, `proof.ts` (receipt access), `seed.ts` / `seed-data.ts`, `page-context.ts`.
- `app/(app)/keuangan/` — pages, `forms.tsx` (add/edit/delete dialogs), `actions.ts`, `unit/`.
- `components/finance/` — charts (column, ranked bars, donut, stacked bar), guide card, Rupiah input, KPI tile, receipt chip.
- Audit trail: every write is recorded ("Keuangan — Aset ditambahkan: … (Kursi)").
- Tests: `npm run test:finance` (95 checks, no database), `npm run test:access` (includes the unit role and menus).

## 8. Not built (ideas)

Excel/CSV import and export of the six tables · actual spending to compare with the RAB · unit-level RAB templates · email/WhatsApp reminders for unpaid registration · a `lastLoginAt` update on sign-in (the column exists but is only set by the demo seed).
