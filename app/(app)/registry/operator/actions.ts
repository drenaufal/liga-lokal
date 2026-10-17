"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import { createOperatorAccount, updateOperatorAccount, newOperatorSchema, editOperatorSchema, OperatorEmailExists } from "@/lib/operator-accounts";

function publicFields(data: FormData) {
  const safe = new FormData();
  for (const key of ["name", "email", "active"]) {
    const value = data.get(key);
    if (typeof value === "string") safe.set(key, value);
  }
  return safe;
}
function refreshOperators() {
  revalidatePath("/registry/operator");
  revalidatePath("/pengaturan");
  revalidatePath("/match-ops", "layout");
}
export async function createOperator(_previous: FormState, formData: FormData): Promise<FormState> {
  const actor = await actionUser("registry.operator:create");
  const parsed = newOperatorSchema.safeParse({ ...Object.fromEntries(formData), active: formData.get("active") === "on" });
  if (!parsed.success) return formError(parsed.error, publicFields(formData));
  try {
    const account = await createOperatorAccount(parsed.data);
    await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "operator.create", entityType: "user", entityId: account.id, summary: "Akun operator dibuat: " + account.name, after: account });
  } catch (error) {
    if (error instanceof OperatorEmailExists) return formError({ email: error.message }, publicFields(formData));
    throw error;
  }
  refreshOperators();
  return undefined;
}
export async function updateOperator(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const actor = await actionUser("registry.operator:edit");
  const parsed = editOperatorSchema.safeParse({ ...Object.fromEntries(formData), active: formData.get("active") === "on" });
  if (!parsed.success) return formError(parsed.error, publicFields(formData));
  try {
    const result = await updateOperatorAccount(id, parsed.data);
    await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "operator.update", entityType: "user", entityId: id, summary: "Akun operator diperbarui: " + result.after.name, before: result.before, after: result.after });
  } catch (error) {
    if (error instanceof OperatorEmailExists) return formError({ email: error.message }, publicFields(formData));
    throw error;
  }
  refreshOperators();
  return undefined;
}
