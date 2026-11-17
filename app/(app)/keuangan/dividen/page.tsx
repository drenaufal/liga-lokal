import type { Metadata } from "next";
import { Award, CalendarCheck, HandCoins, Users } from "lucide-react";
import { loadFinancePage } from "@/lib/finance/page-context";
import { dividendGrandTotal, listDividends } from "@/lib/finance/queries";
import { dividendShares, sum } from "@/lib/finance/calc";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BlockTitle, ColumnHead, UnitTag } from "@/components/finance/bits";
import { CHART_COLORS, RankBars, ShareDonut } from "@/components/finance/charts";
import { GuideCard } from "@/components/finance/guide-card";
import { Kpi } from "@/components/finance/kpi";
import { NoUnitState, ScopeBanner } from "@/components/finance/scope-banner";
import { getI18n } from "@/lib/i18n/server";
import { AddRecordButton, DeleteRecordButton, EditRecordButton, type FinanceRecord } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Dividen") };
}
export const dynamic = "force-dynamic";

export default async function DividendsPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const page = await loadFinancePage(searchParams);
  const { t, fmt, ctx, form, canInput, canDelete, showUnit, user } = page;
  if (page.blocked) return <NoUnitState />;

  const [rows, grand] = await Promise.all([listDividends(ctx.filter), dividendGrandTotal()]);
  const total = sum(rows, (r) => r.amount);
  // A recipient's portion is measured against every unit's dividends, so a unit login still sees "70%" and not "100%".
  const shares = dividendShares(rows, grand);
  const biggest = shares.reduce<(typeof shares)[number] | null>((top, s) => (!top || s.row.amount > top.row.amount ? s : top), null);
  const paid = rows.filter((r) => r.paidOn).length;
  const seesWhole = can(user, "finance:all-units");
  const pct = (fraction: number) => `${(fraction * 100).toLocaleString(fmt.tag, { maximumFractionDigits: 1 })}%`;

  const record = (r: (typeof rows)[number]): FinanceRecord => ({
    id: r.id,
    businessUnitId: r.businessUnitId,
    recipientName: r.recipientName,
    amount: r.amount,
    paidOn: r.paidOn,
    note: r.note,
  });
  const actions = canInput || canDelete;

  return (
    <div>
      <PageHeader
        title={t("Dividen")}
        description={t("Bagian keuntungan yang dibagikan kepada pemodal, beserta porsinya.")}
        actions={canInput && <AddRecordButton kind="dividend" ctx={form} />}
      />
      <ScopeBanner ctx={ctx} />

      <GuideCard
        id="dividen"
        title={t("Cara membaca halaman Dividen")}
        intro={t("Dividen adalah bagian keuntungan yang dibagikan kepada pemodal. Setiap baris menunjukkan siapa menerima berapa, dan berapa persen porsinya dari seluruh dividen yang dibagikan.")}
        terms={[
          { term: t("Penerima"), text: t("Pemodal yang mendapat dividen.") },
          { term: t("Nominal"), text: t("Jumlah dividen untuk penerima itu, dalam Rupiah.") },
          { term: t("Porsi"), text: t("Nominal penerima dibagi total dividen seluruh unit bisnis. Contoh: 70 juta dari 100 juta = 70%.") },
          { term: t("Tanggal dibayar"), text: t("Hari dividen dibayarkan. Tanda “—” berarti belum dicatat.") },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("Total dividen")} value={fmt.rupiahCompact(total)} full={fmt.rupiah(total)} icon={<HandCoins className="size-4" />} block="red" hint={t("{n} pembagian", { n: fmt.number(rows.length) })} />
        <Kpi label={t("Jumlah penerima")} value={fmt.number(new Set(rows.map((r) => `${r.businessUnitId}:${r.recipientName}`)).size)} icon={<Users className="size-4" />} block="blue" hint={t("Pemodal yang menerima dividen")} />
        <Kpi
          label={t("Penerima terbesar")}
          value={biggest ? pct(biggest.share) : "—"}
          full={biggest ? fmt.rupiah(biggest.row.amount) : undefined}
          icon={<Award className="size-4" />}
          block="yellow"
          hint={biggest ? t("{name} · {amount}", { name: biggest.row.recipientName, amount: fmt.rupiahCompact(biggest.row.amount) }) : t("Belum ada data.")}
        />
        <Kpi
          label={t("Sudah dibayarkan")}
          value={`${fmt.number(paid)}/${fmt.number(rows.length)}`}
          icon={<CalendarCheck className="size-4" />}
          block="night"
          hint={t("Baris yang punya tanggal bayar")}
        />
      </div>

      {rows.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("Porsi dividen per penerima")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ShareDonut
                centerLabel={t("Total dividen")}
                slices={rows.map((r, i) => ({ label: showUnit ? `${r.recipientName} · ${r.unitName}` : r.recipientName, value: r.amount, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Nominal per penerima")}</CardTitle>
            </CardHeader>
            <CardContent>
              <RankBars
                items={[...shares]
                  .sort((a, b) => b.row.amount - a.row.amount)
                  .map((s) => ({ label: s.row.recipientName, value: s.row.amount, valueLabel: fmt.rupiah(s.row.amount), sublabel: pct(s.share) }))}
                accent="var(--color-chart-3)"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardContent className="space-y-4">
          <BlockTitle title={t("Daftar dividen")} hint={t("Satu baris untuk setiap penerima.")} />
          {rows.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title={t("Belum ada dividen tercatat")}
              description={canInput ? t("Klik “Tambah dividen” untuk mencatat pembagian pertama.") : t("Belum ada dividen untuk ditampilkan.")}
            />
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-10">No</TH>
                  <TH><ColumnHead label={t("Penerima")} hint={t("Pemodal")} /></TH>
                  {showUnit && <TH>{t("Unit bisnis")}</TH>}
                  <TH className="text-right"><ColumnHead label={t("Nominal")} hint={t("Dividen diterima")} align="right" /></TH>
                  <TH className="min-w-40"><ColumnHead label={t("Porsi")} hint={t("Dari total dividen")} /></TH>
                  <TH><ColumnHead label={t("Tanggal dibayar")} hint={t("Kosong = belum dicatat")} /></TH>
                  {actions && <TH><span className="sr-only">{t("Aksi")}</span></TH>}
                </TR>
              </THead>
              <TBody>
                {shares.map(({ row: r, share }, i) => (
                  <TR key={r.id}>
                    <TD className="tabular-nums text-ink-muted">{i + 1}</TD>
                    <TD>
                      <span className="font-medium text-ink">{r.recipientName}</span>
                      {r.note && <span className="block text-[11px] text-ink-muted">{r.note}</span>}
                    </TD>
                    {showUnit && <TD><UnitTag name={r.unitName} /></TD>}
                    <TD className="text-right font-medium tabular-nums text-ink">{fmt.rupiah(r.amount)}</TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Progress value={share * 100} tone="brand" className="w-24" />
                        <span className="w-12 text-right text-xs font-semibold tabular-nums text-ink">{pct(share)}</span>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap tabular-nums text-ink-muted">{r.paidOn ? fmt.date(r.paidOn) : "—"}</TD>
                    {actions && (
                      <TD>
                        <div className="flex justify-end gap-0.5">
                          {canInput && <EditRecordButton kind="dividend" record={record(r)} ctx={form} />}
                          {canDelete && <DeleteRecordButton kind="dividend" id={r.id} name={r.recipientName} />}
                        </div>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
              <tfoot>
                <tr className="border-t-2 border-line bg-surface-2">
                  <td colSpan={showUnit ? 3 : 2} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                    {t("Total dividen")}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-ink">{fmt.rupiah(total)}</td>
                  <td colSpan={actions ? 3 : 2} className="px-3 py-3 text-xs text-ink-secondary">
                    {seesWhole && grand !== total
                      ? t("Total seluruh unit bisnis: {amount}", { amount: fmt.rupiah(grand) })
                      : t("Porsi dihitung terhadap total dividen seluruh unit bisnis.")}
                  </td>
                </tr>
              </tfoot>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
