import { cache } from "react";
import { db } from "@/lib/db";
import { rolePermissions } from "@/lib/db/schema";
import {
  ALL_CAPABILITIES,
  EDITABLE_ROLES,
  diffAgainstDefaults,
  resolveGrants,
  type Capability,
  type EditableRole,
  type GrantMatrix,
  type Role,
  type RoleOverrides,
} from "./rbac";

let warnedMissingTable = false;

/**
 * Saved overrides, read once per request. If the `role_permissions` table has
 * not been migrated yet the app keeps running on the factory defaults.
 */
export const getRoleOverrides = cache(async (): Promise<RoleOverrides> => {
  let rows: { role: Role; capability: string; granted: boolean }[];
  try {
    rows = await db
      .select({
        role: rolePermissions.role,
        capability: rolePermissions.capability,
        granted: rolePermissions.granted,
      })
      .from(rolePermissions);
  } catch (e) {
    if (!warnedMissingTable) {
      warnedMissingTable = true;
      console.error("role_permissions unavailable (run `npm run db:migrate`), using default access matrix", e);
    }
    return {};
  }

  const known = new Set<string>(ALL_CAPABILITIES);
  const out: RoleOverrides = {};
  for (const row of rows) {
    if (row.role === "super_admin" || !known.has(row.capability)) continue;
    (out[row.role] ??= {})[row.capability as Capability] = !!row.granted;
  }
  return out;
});

/** Effective capabilities of one role (Super Admin gets everything). */
export async function getGrantsForRole(role: Role): Promise<Capability[]> {
  if (role === "super_admin") return [...ALL_CAPABILITIES];
  return resolveGrants(role, await getRoleOverrides());
}

/** Effective grants of every editable role, for the access-management screen. */
export async function getGrantMatrix(): Promise<GrantMatrix> {
  const overrides = await getRoleOverrides();
  return Object.fromEntries(
    EDITABLE_ROLES.map((r) => [r, resolveGrants(r, overrides)]),
  ) as GrantMatrix;
}

/** Replaces the saved overrides with the minimal diff of `matrix` against the defaults. */
export async function saveGrantMatrix(matrix: GrantMatrix, updatedBy: string) {
  const overrides = diffAgainstDefaults(matrix);
  const rows = EDITABLE_ROLES.flatMap((role) =>
    Object.entries(overrides[role] ?? {}).map(([capability, granted]) => ({
      role: role as EditableRole,
      capability,
      granted: !!granted,
      updatedBy,
    })),
  );

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions);
    if (rows.length) await tx.insert(rolePermissions).values(rows);
  });
  return overrides;
}
