import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Calculator, Clock, HandCoins, Landmark, Package, Wallet } from "lucide-react";
import { loadFinancePage } from "@/lib/finance/page-context";
import { getUnitDatasets } from "@/lib/finance/queries";
import { budgetByCategory, combineFigures, matchFeeByWeek, sum, unitFigures } from "@/lib/finance/calc";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BlockTitle, ColumnHead, Notice } from "@/components/finance/bits";
import { ColumnChart, RankBars, ShareDonut } from "@/components/finance/charts";
import { GuideCard } from "@/components/finance/guide-card";
import { Kpi } from "@/components/finance/kpi";
import { NoUnitState, ScopeBanner } from "@/components/finance/scope-banner";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Keuangan") };
}
export const dynamic = "force-dynamic";

export default async function FinanceSummaryPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const page = await loadFinancePage(searchParams);
  const { t, fmt, ctx, showUnit } = page;
  if (page.blocked) return <NoUnitState />;

  const sets = await getUnitDatasets(ctx.units, ctx.filter);
  const perUnit = sets.map((s) => ({ ...s, figures: unitFigures(s.dataset) }));
  const f = combineFigures(perUnit.map((p) => p.figures));
  const programWeeks = Math.max(0, ...perUnit.map((p) => p.unit.programWeeks));
  const empty = f.capital.count + f.assets.count + f.registration.clubs + f.matchFee.matches + f.budget.lines + f.dividends.count === 0;

  const href = (path: string) => (ctx.unit && ctx.scope.allUnits ? `${path}?unit=${encodeURIComponent(ctx.unit.code)}` : path);
  const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;
  const pct1 = (fraction: number) => `${(fraction * 100).toLocaleString(fmt.tag, { maximumFractionDigits: 1 })}%`;

  const weeks = matchFeeByWeek(perUnit.flatMap((p) => p.dataset.matchFees), programWeeks);
  const byCategory = new Map<string, number>();
  for (const p of perUnit) {
    for (const c of budgetByCategory(p.dataset.budget, p.unit.programWeeks)) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + c.amount);
  }
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const tiles = [
    {
      href: "/keuangan/modal",
      label: t("Modal masuk"),
      value: f.capital.total,
      icon: <Landmark className="size-4" />,
      block: "red" as const,
      hint: t("{pct} sudah kembali · {amount} belum", { pct: pct(f.capital.returnedShare), amount: fmt.rupiahCompact(f.capital.outstanding) }),
    },
    {
      href: "/keuangan/aset",
      label: t("Aset dibeli"),
      value: f.assets.total,
      icon: <Package className="size-4" />,
      block: "blue" as const,
      hint: t("{n} pembelian", { n: fmt.number(f.assets.count) }),
    },
    {
      href: "/keuangan/registrasi",
      label: t("Uang masuk"),
      value: f.income,
      icon: <Wallet className="size-4" />,
      block: "yellow" as const,
      hint: t("Registrasi {reg} · match fee {fee}", { reg: fmt.rupiahCompact(f.registration.received), fee: fmt.rupiahCompact(f.matchFee.amount) }),
    },
    {
      href: "/keuangan/registrasi",
      label: t("Sisa tagihan registrasi"),
      value: f.registration.remaining,
      icon: <Clock className="size-4" />,
      block: "white" as const,
      tone: f.registration.remaining > 0 ? ("warn" as const) : ("default" as const),
      hint: t("{paid} dari {n} klub sudah lunas", { paid: fmt.number(f.registration.paidClubs), n: fmt.number(f.registration.clubs) }),
    },
    {
      href: "/keuangan/rab",
      label: t("Anggaran (RAB)"),
      value: f.budget.total,
      icon: <Calculator className="size-4" />,
      block: "night" as const,
      hint: t("{week} per minggu · {monthly} bulanan", { week: fmt.rupiahCompact(f.budget.weeklyPerWeek), monthly: fmt.rupiahCompact(f.budget.monthly) }),
    },
    {
      href: "/keuangan/dividen",
      label: t("Dividen"),
      value: f.dividends.total,
      icon: <HandCoins className="size-4" />,
      block: "white" as const,
      hint: t("{n} penerima", { n: fmt.number(f.dividends.count) }),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("Keuangan")}
        description={t("Ringkasan modal, aset, uang masuk, anggaran, dan dividen — dalam satu halaman.")}
      />
      <ScopeBanner ctx={ctx} />

      <GuideCard
        id="ringkasan"
        title={t("Cara membaca ringkasan ini")}
        intro={t("Halaman ini merangkum enam jenis catatan keuangan. Setiap kotak berwarna adalah satu jenis catatan; klik kotaknya untuk melihat tabel rincinya. Angka besar dipendekkan (1 jt = 1 juta Rupiah) — arahkan kursor ke angka untuk melihat nilai lengkapnya.")}
        terms={[
          { term: t("Modal masuk"), text: t("Uang yang disetor pemodal, dan berapa persen yang sudah dikembalikan.") },
          { term: t("Aset dibeli"), text: t("Peralatan dan sarana pertandingan yang sudah dibeli.") },
          { term: t("Uang masuk"), text: t("Uang dari klub: registrasi (DP + pelunasan) ditambah match fee.") },
          { term: t("Sisa tagihan registrasi"), text: t("Biaya registrasi yang sudah ditagih tetapi belum dibayar klub.") },
          { term: t("Anggaran (RAB)"), text: t("Perkiraan seluruh pengeluaran: biaya mingguan seluruh program ditambah biaya bulanan.") },
          { term: t("Dividen"), text: t("Bagian keuntungan yang dibagikan kepada pemodal.") },
        ]}
      />

      {empty && (
        <Notice tone="info" title={t("Belum ada data keuangan")} className="mb-4">
          {t("Mulai dari tab Modal, Aset, Registrasi, Match Fee, atau RAB. Angka di halaman ini akan terisi sendiri begitu data dimasukkan.")}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.label} href={href(tile.href)} className="group block rounded-2xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-brand/40 hover:-translate-y-0.5">
            <Kpi
              label={tile.label}
              value={fmt.rupiahCompact(tile.value)}
              full={fmt.rupiah(tile.value)}
              icon={tile.icon}
              block={tile.block}
              tone={tile.tone}
              hint={tile.hint}
            />
          </Link>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="space-y-3">
          <BlockTitle
            title={t("Seberapa jauh anggaran tertutup uang masuk?")}
            hint={t("Uang masuk dari klub dibandingkan dengan estimasi OPEX di RAB.")}
            right={
              <Link href={href("/keuangan/rab")} className="flex shrink-0 items-center gap-1 text-[11px] text-ink-muted hover:text-ink">
                {t("Lihat RAB")} <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          <div className="flex items-end justify-between gap-3">
            <p className="font-display text-4xl tracking-wide tabular-nums text-ink">{pct1(f.budgetCoverage)}</p>
            <p className="pb-1 text-right text-xs text-ink-muted">
              {t("{income} dari {budget}", { income: fmt.rupiah(f.income), budget: fmt.rupiah(f.budget.total) })}
            </p>
          </div>
          <Progress value={f.budgetCoverage * 100} tone={f.budgetCoverage >= 1 ? "success" : "brand"} />
          <p className="text-xs text-ink-secondary">
            {f.budget.total === 0
              ? t("Belum ada anggaran (RAB), jadi belum ada pembanding.")
              : f.budgetCoverage >= 1
                ? t("Uang masuk sudah menutup seluruh estimasi OPEX.")
                : t("Masih kurang {amount} untuk menutup seluruh estimasi OPEX.", { amount: fmt.rupiah(f.budget.total - f.income) })}
          </p>
        </CardContent>
      </Card>

      {!empty && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("Match fee masuk per minggu")}</CardTitle>
              <Link href={href("/keuangan/match-fee")} className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink">
                {t("Rincian")} <ArrowUpRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {f.matchFee.matches > 0 ? (
                <ColumnChart
                  data={weeks.map((w) => ({ label: `${w.week}`, value: w.amount, detail: t("{n} laga", { n: w.matches }) }))}
                  summary={t("Match fee per minggu, total {total}", { total: fmt.rupiah(f.matchFee.amount) })}
                  emptyLabel={t("Belum berjalan")}
                />
              ) : (
                <p className="py-10 text-center text-xs text-ink-muted">{t("Belum ada match fee tercatat")}</p>
              )}
              <p className="text-center text-[10px] uppercase tracking-wider text-ink-muted">{t("Minggu ke-")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Status modal")}</CardTitle>
              <Link href={href("/keuangan/modal")} className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink">
                {t("Rincian")} <ArrowUpRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {f.capital.total > 0 ? (
                <ShareDonut
                  size={116}
                  centerLabel={t("Total modal")}
                  slices={[
                    { label: t("Sudah kembali"), value: f.capital.returned, color: "var(--color-success)" },
                    { label: t("Belum kembali"), value: f.capital.outstanding, color: "var(--color-warn)" },
                  ]}
                />
              ) : (
                <p className="py-10 text-center text-xs text-ink-muted">{t("Belum ada modal tercatat")}</p>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>{t("Kategori biaya terbesar di RAB")}</CardTitle>
              <Link href={href("/keuangan/rab")} className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink">
                {t("Rincian")} <ArrowUpRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {topCategories.length ? (
                <RankBars
                  items={topCategories.map(([label, value]) => ({
                    label,
                    value,
                    valueLabel: fmt.rupiah(value),
                    sublabel: f.budget.total ? `${Math.round((value / f.budget.total) * 100)}%` : undefined,
                  }))}
                  accent="var(--color-chart-2)"
                />
              ) : (
                <p className="py-6 text-center text-xs text-ink-muted">{t("Belum ada anggaran tercatat")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showUnit && perUnit.length > 0 && (
        <Card className="mt-4">
          <CardContent className="space-y-4">
            <BlockTitle title={t("Ringkasan per unit bisnis")} hint={t("Klik sebuah unit untuk melihat rinciannya.")} />
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH><ColumnHead label={t("Unit bisnis")} /></TH>
                  <TH className="text-right"><ColumnHead label={t("Modal")} align="right" /></TH>
                  <TH className="text-right"><ColumnHead label={t("Aset")} align="right" /></TH>
                  <TH className="text-right"><ColumnHead label={t("Uang masuk")} hint={t("Registrasi + match fee")} align="right" /></TH>
                  <TH className="text-right"><ColumnHead label={t("RAB")} hint={t("Estimasi OPEX")} align="right" /></TH>
                  <TH className="text-right"><ColumnHead label={t("Dividen")} align="right" /></TH>
                  <TH className="min-w-36"><ColumnHead label={t("Anggaran tertutup")} hint={t("Uang masuk ÷ RAB")} /></TH>
                </TR>
              </THead>
              <TBody>
                {perUnit.map(({ unit, figures: u }) => (
                  <TR key={unit.id}>
                    <TD>
                      <Link href={`/keuangan?unit=${encodeURIComponent(unit.code)}`} className="font-semibold text-ink hover:text-brand">
                        {unit.name}
                      </Link>
                      {!unit.active && <span className="ml-2 text-[11px] text-ink-muted">({t("nonaktif")})</span>}
                    </TD>
                    <TD className="text-right tabular-nums">{fmt.rupiah(u.capital.total)}</TD>
                    <TD className="text-right tabular-nums">{fmt.rupiah(u.assets.total)}</TD>
                    <TD className="text-right tabular-nums">{fmt.rupiah(u.income)}</TD>
                    <TD className="text-right tabular-nums">{fmt.rupiah(u.budget.total)}</TD>
                    <TD className="text-right tabular-nums">{fmt.rupiah(u.dividends.total)}</TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Progress value={u.budgetCoverage * 100} className="w-20" />
                        <span className="w-12 text-right text-xs font-semibold tabular-nums text-ink">{u.budget.total ? pct1(u.budgetCoverage) : "—"}</span>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
              <tfoot>
                <tr className="border-t-2 border-line bg-surface-2 text-sm font-bold tabular-nums text-ink">
                  <td className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">{t("Semua unit")}</td>
                  <td className="px-3 py-3 text-right">{fmt.rupiah(f.capital.total)}</td>
                  <td className="px-3 py-3 text-right">{fmt.rupiah(f.assets.total)}</td>
                  <td className="px-3 py-3 text-right">{fmt.rupiah(f.income)}</td>
                  <td className="px-3 py-3 text-right">{fmt.rupiah(f.budget.total)}</td>
                  <td className="px-3 py-3 text-right">{fmt.rupiah(f.dividends.total)}</td>
                  <td className="px-3 py-3 text-xs">{f.budget.total ? pct1(f.budgetCoverage) : "—"}</td>
                </tr>
              </tfoot>
            </Table>
            {perUnit.length > 1 && sum(perUnit, (p) => p.figures.income) > 0 && (
              <div className="grid gap-4 border-t border-line-soft pt-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold text-ink">{t("Uang masuk per unit")}</p>
                  <RankBars
                    items={[...perUnit].sort((a, b) => b.figures.income - a.figures.income).map((p) => ({ label: p.unit.name, value: p.figures.income, valueLabel: fmt.rupiah(p.figures.income) }))}
                    accent="var(--color-chart-1)"
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-ink">{t("Modal per unit")}</p>
                  <RankBars
                    items={[...perUnit].sort((a, b) => b.figures.capital.total - a.figures.capital.total).map((p) => ({ label: p.unit.name, value: p.figures.capital.total, valueLabel: fmt.rupiah(p.figures.capital.total) }))}
                    accent="var(--color-chart-3)"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {perUnit.length === 0 && (
        <EmptyState className="mt-4" icon={Wallet} title={t("Belum ada unit bisnis")} description={t("Unit bisnis didaftarkan oleh administrator.")} />
      )}
    </div>
  );
}
