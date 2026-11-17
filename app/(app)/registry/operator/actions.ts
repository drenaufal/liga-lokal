"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth/session";
import { auditText, recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import { createOperatorAccount, updateOperatorAccount, makeNewOperatorSchema, makeEditOperatorSchema, OperatorEmailExists, UnknownCompetition } from "@/lib/operator-accounts";
import { getT } from "@/lib/i18n/server";

function publicFields(data: FormData) {
  const safe = new FormData();
  for (const key of ["name", "email", "active"]) {
    const value = data.get(key);
    if (typeof value === "string") safe.set(key, value);
  }
  return safe;
}
/** The form fields as the schema expects them: a checkbox for `active`, one entry per assigned Turnamen. */
function input(formData: FormData) {
  return {
    ...Object.fromEntries(formData),
    active: formData.get("active") === "on",
    competitionIds: formData.getAll("competitionIds").map(String).filter(Boolean),
  };
}
function refreshOperators() {
  revalidatePath("/registry/operator");
  revalidatePath("/pengaturan");
  revalidatePath("/match-ops", "layout");
  revalidatePath("/kompetisi", "layout");
}
export async function createOperator(_previous: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const actor = await actionUser("registry.operator:create");
  const parsed = makeNewOperatorSchema(t).safeParse(input(formData));
  if (!parsed.success) return formError(t, parsed.error, publicFields(formData));
  try {
    const account = await createOperatorAccount(parsed.data);
    await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "operator.create", entityType: "user", entityId: account.id, summary: auditText("Akun operator dibuat: {name} ({n} turnamen)", { name: account.name, n: account.competitionIds.length }), after: account });
  } catch (error) {
    if (error instanceof OperatorEmailExists) return formError(t, { email: t("Email sudah terdaftar.") }, publicFields(formData));
    if (error instanceof UnknownCompetition) return formError(t, { competitionIds: t("Turnamen tidak ditemukan. Muat ulang halaman lalu coba lagi.") }, publicFields(formData));
    throw error;
  }
  refreshOperators();
  return undefined;
}
export async function updateOperator(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const actor = await actionUser("registry.operator:edit");
  const parsed = makeEditOperatorSchema(t).safeParse(input(formData));
  if (!parsed.success) return formError(t, parsed.error, publicFields(formData));
  try {
    const result = await updateOperatorAccount(id, parsed.data);
    await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "operator.update", entityType: "user", entityId: id, summary: auditText("Akun operator diperbarui: {name} ({n} turnamen)", { name: result.after.name, n: result.after.competitionIds.length }), before: result.before, after: result.after });
  } catch (error) {
    if (error instanceof OperatorEmailExists) return formError(t, { email: t("Email sudah terdaftar.") }, publicFields(formData));
    if (error instanceof UnknownCompetition) return formError(t, { competitionIds: t("Turnamen tidak ditemukan. Muat ulang halaman lalu coba lagi.") }, publicFields(formData));
    throw error;
  }
  refreshOperators();
  return undefined;
}
