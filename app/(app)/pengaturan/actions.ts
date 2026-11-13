"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth/session";
import { auditText, recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import {
  createUserAccount,
  updateUserAccount,
  makeNewUserSchema,
  makeEditUserSchema,
  UserEmailExists,
  UserRuleError,
} from "@/lib/user-accounts";
import { getT } from "@/lib/i18n/server";

/** Echoed back after a failed submit; the password is deliberately left out. */
function publicFields(data: FormData) {
  const safe = new FormData();
  for (const key of ["name", "email", "title", "role", "active"]) {
    const value = data.get(key);
    if (typeof value === "string") safe.set(key, value);
  }
  return safe;
}
function raw(formData: FormData) {
  return { ...Object.fromEntries(formData), active: formData.get("active") === "on" };
}
function refresh() {
  revalidatePath("/pengaturan");
  revalidatePath("/registry/operator");
  revalidatePath("/match-ops", "layout");
}

export async function createUser(_previous: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const actor = await actionUser("settings.users:create");
  const parsed = makeNewUserSchema(t).safeParse(raw(formData));
  if (!parsed.success) return formError(t, parsed.error, publicFields(formData));
  try {
    const account = await createUserAccount(actor, parsed.data);
    await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "user.create", entityType: "user", entityId: account.id, summary: auditText("Akun pengguna dibuat: {name} ({role})", { name: account.name, role: account.role }), after: account });
  } catch (error) {
    if (error instanceof UserEmailExists) return formError(t, { email: error.message }, publicFields(formData));
    if (error instanceof UserRuleError) return formError(t, {}, publicFields(formData), error.message);
    throw error;
  }
  refresh();
  return undefined;
}

export async function updateUser(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const actor = await actionUser("settings.users:edit");
  const parsed = makeEditUserSchema(t).safeParse(raw(formData));
  if (!parsed.success) return formError(t, parsed.error, publicFields(formData));
  try {
    const result = await updateUserAccount(actor, id, parsed.data);
    const roleChanged = result.before.role !== result.after.role;
    await recordAudit({
      actorId: actor.id, actorName: actor.name, actorRole: actor.role,
      action: roleChanged ? "user.role" : "user.update", entityType: "user", entityId: id,
      summary: roleChanged
        ? auditText("Akun pengguna diperbarui: {name} ({from} → {to})", { name: result.after.name, from: result.before.role, to: result.after.role })
        : auditText("Akun pengguna diperbarui: {name}", { name: result.after.name }),
      before: result.before, after: result.after,
    });
  } catch (error) {
    if (error instanceof UserEmailExists) return formError(t, { email: error.message }, publicFields(formData));
    if (error instanceof UserRuleError) return formError(t, {}, publicFields(formData), error.message);
    throw error;
  }
  refresh();
  return undefined;
}
