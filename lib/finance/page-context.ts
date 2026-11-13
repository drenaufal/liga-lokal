import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getI18n } from "@/lib/i18n/server";
import type { FormContext } from "@/app/(app)/keuangan/forms";
import { resolveFinanceContext } from "./access";

type SearchParams = Promise<{ unit?: string }>;

/**
 * What every Keuangan data page needs before it renders: who is asking, whose data to show, whether
 * they may add / delete, and the settings the add-edit dialogs start from. Pages call this first.
 */
export async function loadFinancePage(searchParams: SearchParams) {
  const user = await requireCapability("finance:view");
  const { t, fmt, locale } = await getI18n();
  const sp = await searchParams;
  const ctx = await resolveFinanceContext(user, sp.unit);

  const canInput = can(user, "finance:input") && !ctx.noUnit;
  const canDelete = can(user, "finance:delete") && !ctx.noUnit;
  const activeUnits = ctx.units.filter((u) => u.active);
  const form: FormContext = {
    units: activeUnits.map((u) => ({ id: u.id, name: u.name })),
    chooseUnit: ctx.scope.allUnits,
    defaultUnitId: ctx.unit?.id ?? null,
    programWeeks: ctx.unit?.programWeeks,
    canDelete,
  };

  return {
    user,
    t,
    fmt,
    locale,
    ctx,
    form,
    canInput,
    canDelete,
    /** More than one unit's rows can appear → tables get a "Unit" column. */
    showUnit: ctx.filter === null,
    /** Nothing to show for a login that is in no unit. */
    blocked: ctx.noUnit,
  };
}

export type FinancePage = Awaited<ReturnType<typeof loadFinancePage>>;
