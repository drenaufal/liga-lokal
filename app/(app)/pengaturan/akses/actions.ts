"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth/session";
import { getGrantMatrix, saveGrantMatrix } from "@/lib/auth/permissions";
import {
  ALL_CAPABILITIES,
  EDITABLE_ROLES,
  ROLE_LABEL,
  normalizeGrants,
  type Capability,
  type GrantMatrix,
} from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";

/** Only the Super Admin ("access:manage" is restricted to that role) can change what each role may do. */
export async function saveAccessMatrix(input: Record<string, string[]>) {
  const actor = await actionUser("access:manage");

  const known = new Set<string>(ALL_CAPABILITIES);
  const matrix = {} as GrantMatrix;
  for (const role of EDITABLE_ROLES) {
    const list = input?.[role];
    if (!Array.isArray(list)) throw new Error(`Data hak akses untuk peran ${ROLE_LABEL[role]} tidak lengkap.`);
    if (list.some((c) => typeof c !== "string" || !known.has(c))) throw new Error("Terdapat izin yang tidak dikenal.");
    matrix[role] = normalizeGrants(role, list as Capability[]);
  }

  const before = await getGrantMatrix();
  await saveGrantMatrix(matrix, actor.id);

  const changes = EDITABLE_ROLES.flatMap((role) => {
    const was = new Set(before[role]);
    const now = new Set(matrix[role]);
    const added = matrix[role].filter((c) => !was.has(c));
    const removed = before[role].filter((c) => !now.has(c));
    return added.length || removed.length ? [{ role, added, removed }] : [];
  });

  if (changes.length) {
    await recordAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "access.update",
      entityType: "role_permissions",
      summary:
        "Hak akses peran diperbarui: " +
        changes.map((c) => `${ROLE_LABEL[c.role]} (+${c.added.length} / −${c.removed.length})`).join(", "),
      before: Object.fromEntries(changes.map((c) => [c.role, before[c.role]])),
      after: Object.fromEntries(changes.map((c) => [c.role, matrix[c.role]])),
    });
  }

  // Navigation, buttons and server-side checks all derive from the matrix.
  revalidatePath("/", "layout");
  return { changedRoles: changes.length };
}
