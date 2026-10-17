"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import {
  createUserAccount,
  updateUserAccount,
  newUserSchema,
  editUserSchema,
  UserEmailExists,
  UserRuleError,
} from "@/lib/user-accounts";

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
  const actor = await actionUser("settings.users:create");
  const parsed = newUserSchema.safeParse(raw(formData));
  if (!parsed.success) return formError(parsed.error, publicFields(formData));
  try {
    const account = await createUserAccount(actor, parsed.data);
    await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "user.create", entityType: "user", entityId: account.id, summary: `Akun pengguna dibuat: ${account.name} (${account.role})`, after: account });
  } catch (error) {
    if (error instanceof UserEmailExists) return formError({ email: error.message }, publicFields(formData));
    if (error instanceof UserRuleError) return formError({}, publicFields(formData), error.message);
    throw error;
  }
  refresh();
  return undefined;
}

export async function updateUser(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const actor = await actionUser("settings.users:edit");
  const parsed = editUserSchema.safeParse(raw(formData));
  if (!parsed.success) return formError(parsed.error, publicFields(formData));
  try {
    const result = await updateUserAccount(actor, id, parsed.data);
    const roleChanged = result.before.role !== result.after.role;
    await recordAudit({
      actorId: actor.id, actorName: actor.name, actorRole: actor.role,
      action: roleChanged ? "user.role" : "user.update", entityType: "user", entityId: id,
      summary: `Akun pengguna diperbarui: ${result.after.name}${roleChanged ? ` (${result.before.role} → ${result.after.role})` : ""}`,
      before: result.before, after: result.after,
    });
  } catch (error) {
    if (error instanceof UserEmailExists) return formError({ email: error.message }, publicFields(formData));
    if (error instanceof UserRuleError) return formError({}, publicFields(formData), error.message);
    throw error;
  }
  refresh();
  return undefined;
}
