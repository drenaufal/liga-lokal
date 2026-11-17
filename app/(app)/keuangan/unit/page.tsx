import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, Mail } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getFinanceScope, listVisibleUnits } from "@/lib/finance/access";
import { listUnitLogins } from "@/lib/finance/units";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Notice } from "@/components/finance/bits";
import { getI18n } from "@/lib/i18n/server";
import { LoginCreate, LoginEdit, UnitCreate, UnitEdit } from "./unit-manage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Unit Bisnis") };
}
export const dynamic = "force-dynamic";

export default async function BusinessUnitsPage() {
  const { t, fmt } = await getI18n();
  const user = await requireCapability("finance.units:manage");
  const scope = await getFinanceScope(user);
  const [units, logins] = await Promise.all([listVisibleUnits(scope), listUnitLogins()]);

  return (
    <div>
      <PageHeader
        title={t("Unit Bisnis")}
        description={t("Daftar unit bisnis dan akun login masing-masing. Setiap akun hanya melihat dan mengisi data unitnya sendiri.")}
        actions={<UnitCreate />}
      />

      <Notice className="mb-5" title={t("Bagaimana akses unit bekerja")}>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>{t("Akun unit bisnis hanya melihat dan mengisi enam jenis data milik unitnya.")}</li>
          <li>{t("Administrator melihat semua unit, dan memakai filter “Unit bisnis” di kanan atas untuk melihat satu unit.")}</li>
          <li>{t("Lupa kata sandi? Buka “Ubah akun login” pada unit terkait dan isi kata sandi baru.")}</li>
        </ul>
      </Notice>

      {units.length === 0 ? (
        <EmptyState icon={Building2} title={t("Belum ada unit bisnis")} description={t("Klik “Tambah unit bisnis” untuk mendaftarkan unit pertama.")} />
      ) : (
        <div className="space-y-4">
          {units.map((unit) => {
            const mine = logins.filter((l) => l.unitId === unit.id);
            return (
              <Card key={unit.id}>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight text-ink">{unit.name}</h2>
                        <Badge tone="neutral">{unit.code}</Badge>
                        <Badge tone={unit.active ? "success" : "warn"} dot>
                          {unit.active ? t("Aktif") : t("Nonaktif")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {t("{n} minggu program", { n: unit.programWeeks })}
                        {unit.description ? ` · ${unit.description}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/keuangan?unit=${encodeURIComponent(unit.code)}`}
                        className="flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-ink"
                      >
                        {t("Lihat keuangan")} <ArrowUpRight className="size-3" />
                      </Link>
                      <UnitEdit unit={unit} />
                      <LoginCreate unitId={unit.id} unitName={unit.name} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      {t("Akun login")} · {fmt.number(mine.length)}
                    </p>
                    {mine.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-line px-4 py-3 text-xs text-ink-muted">
                        {t("Belum ada akun login. Tanpa akun, unit ini hanya bisa diisi oleh administrator.")}
                      </p>
                    ) : (
                      <ul className="divide-y divide-line-soft rounded-xl border border-line">
                        {mine.map((login) => (
                          <li key={login.userId} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted">
                              <Mail className="size-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink">{login.name}</p>
                              <p className="truncate text-xs text-ink-muted">{login.email}</p>
                            </div>
                            <Badge tone={login.active ? "success" : "warn"}>{login.active ? t("Aktif") : t("Nonaktif")}</Badge>
                            <LoginEdit login={{ userId: login.userId, name: login.name, email: login.email, active: login.active }} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
