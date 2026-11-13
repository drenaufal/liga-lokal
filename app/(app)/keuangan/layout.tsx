import { Suspense } from "react";
import { DatabaseZap } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { allowedChildHrefs } from "@/lib/nav";
import { financeReady, getFinanceScope, listVisibleUnits } from "@/lib/finance/access";
import { EmptyState } from "@/components/ui/misc";
import { getI18n } from "@/lib/i18n/server";
import { FinanceTabs } from "./tabs";
import { UnitFilter } from "./unit-filter";

export default async function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const user = await requireCapability("finance:view");

  // The tables arrive with migration 0008. Until it has run, say so instead of failing with a SQL error.
  if (!(await financeReady())) {
    return (
      <EmptyState
        icon={DatabaseZap}
        title={t("Modul Keuangan belum siap")}
        description={
          can(user, "finance.units:manage")
            ? t("Basis data belum memiliki tabel keuangan. Jalankan “npm run db:migrate”, lalu “npm run db:seed:finance” untuk memuat data dari Excel.")
            : t("Modul ini sedang disiapkan. Hubungi administrator.")
        }
      />
    );
  }

  const scope = await getFinanceScope(user);
  const units = scope.allUnits ? await listVisibleUnits(scope) : [];

  return (
    <div>
      <div className="mb-4 border-b border-line">
        <Suspense fallback={<div className="h-11" />}>
          <FinanceTabs allowed={allowedChildHrefs("keuangan", user)} />
        </Suspense>
      </div>
      {scope.allUnits && units.length > 0 && (
        <Suspense fallback={null}>
          <UnitFilter
            label={t("Unit bisnis")}
            allLabel={t("Semua unit")}
            options={units.map((u) => ({ value: u.code, label: u.active ? u.name : `${u.name} (${t("nonaktif")})` }))}
          />
        </Suspense>
      )}
      {children}
    </div>
  );
}
