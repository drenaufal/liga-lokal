import { and, eq, or } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { db } from "@/lib/db";
import { finAssets, finMatchFees, finRegistrations } from "@/lib/db/schema";
import { can, type AccessSubject } from "@/lib/auth/rbac";
import { mediaUrl } from "@/lib/media";
import { getFinanceScope } from "./access";

/**
 * Receipts are private documents. Besides the people who may open identity documents, a receipt is
 * readable by (a) whoever uploaded it, while they are still filling in the form, and (b) the logins
 * that may see the unit whose record it is attached to — an administrator for any unit, a unit
 * login only for its own.
 */
export async function canOpenFinanceProof(
  user: { id: string } & Exclude<AccessSubject, string | null | undefined>,
  file: { id: string; uploadedBy: string | null },
): Promise<boolean> {
  if (!can(user, "finance:view")) return false;
  if (file.uploadedBy === user.id && can(user, "finance:input")) return true;

  const scope = await getFinanceScope(user);
  if (!scope.allUnits && !scope.unitId) return false;
  const url = mediaUrl(file.id);
  const mine = (column: AnyMySqlColumn) => (scope.allUnits ? undefined : eq(column, scope.unitId!));

  try {
    const hits = await Promise.all([
      db
        .select({ id: finAssets.id })
        .from(finAssets)
        .where(and(eq(finAssets.proofUrl, url), mine(finAssets.businessUnitId)))
        .limit(1),
      db
        .select({ id: finRegistrations.id })
        .from(finRegistrations)
        .where(
          and(
            or(eq(finRegistrations.dpProofUrl, url), eq(finRegistrations.finalProofUrl, url)),
            mine(finRegistrations.businessUnitId),
          ),
        )
        .limit(1),
      db
        .select({ id: finMatchFees.id })
        .from(finMatchFees)
        .where(and(eq(finMatchFees.proofUrl, url), mine(finMatchFees.businessUnitId)))
        .limit(1),
    ]);
    return hits.some((rows) => rows.length > 0);
  } catch {
    return false;
  }
}
