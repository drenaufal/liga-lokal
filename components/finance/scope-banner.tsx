import { Building2, Eye, UserX } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { getI18n } from "@/lib/i18n/server";
import type { FinanceContext } from "@/lib/finance/access";

/** One line that says whose numbers are on screen, so nobody mistakes one unit's totals for everyone's. */
export async function ScopeBanner({ ctx }: { ctx: FinanceContext }) {
  const { t } = await getI18n();
  if (ctx.noUnit) return null;
  const Icon = ctx.unit ? Building2 : Eye;
  const text = ctx.unit
    ? ctx.scope.allUnits
      ? t("Menampilkan unit {name}", { name: ctx.unit.name })
      : t("Anda melihat data unit {name}", { name: ctx.unit.name })
    : t("Menampilkan semua unit bisnis ({n}). Pilih satu unit di kanan atas untuk memfilter.", { n: ctx.units.length });
  return (
    <p className="mb-4 flex w-fit max-w-full items-start gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2 text-xs leading-relaxed text-ink-secondary">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
      <span>{text}</span>
    </p>
  );
}

/** For a login that has not been linked to any business unit yet. */
export async function NoUnitState() {
  const { t } = await getI18n();
  return (
    <EmptyState
      icon={UserX}
      title={t("Akun Anda belum terhubung ke unit bisnis")}
      description={t("Minta administrator untuk menghubungkan akun ini ke sebuah unit bisnis. Setelah itu data keuangan unit Anda muncul di sini.")}
    />
  );
}
