import { z } from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import type { TFunction } from "@/lib/i18n/translate";
import { competitions, operatorCompetitions, users } from "@/lib/db/schema";
import { getSafeT } from "@/lib/i18n/server";

const identity = (t: TFunction) => ({
  name: z.string().trim().min(2, t("Nama minimal 2 karakter")).max(200),
  email: z.string().trim().toLowerCase().pipe(z.email(t("Email tidak valid")).max(255)),
  active: z.boolean().default(true),
  /** The Turnamen the operator may see and run. Any number; none means the operator sees no Turnamen. */
  competitionIds: z.array(z.string().uuid()).default([]),
});
const passwordField = (t: TFunction) => z.string().min(8, t("Kata sandi minimal 8 karakter")).max(72, t("Kata sandi maksimal 72 byte"))
  .refine((v) => new TextEncoder().encode(v).length <= 72, t("Kata sandi maksimal 72 byte"));
export const makeNewOperatorSchema = (t: TFunction) => z.object({ ...identity(t), password: passwordField(t) });
export const makeEditOperatorSchema = (t: TFunction) =>
  z.object({ ...identity(t), password: z.preprocess((v) => v === "" ? undefined : v, passwordField(t).optional()) });
export type NewOperatorInput = z.input<ReturnType<typeof makeNewOperatorSchema>>;
export type EditOperatorInput = z.input<ReturnType<typeof makeEditOperatorSchema>>;

function duplicateEmail(error: unknown) {
  const cause = error as { code?: string; cause?: { code?: string } };
  return cause.code === "ER_DUP_ENTRY" || cause.cause?.code === "ER_DUP_ENTRY";
}
export class OperatorEmailExists extends Error {
  constructor() { super("Email sudah terdaftar."); }
}
export class UnknownCompetition extends Error {
  constructor() { super("Turnamen tidak ditemukan."); }
}

/** Every Turnamen, by name then season — the choices of the assignment picker. */
export async function getCompetitionChoices() {
  return db
    .select({ id: competitions.id, name: competitions.name, season: competitions.season })
    .from(competitions)
    .orderBy(asc(competitions.name), asc(competitions.season));
}

/** Turnamen ids per operator, for the list and the edit dialog. */
export async function getOperatorAssignments(userIds: string[]) {
  const out = new Map<string, string[]>();
  if (!userIds.length) return out;
  const rows = await db
    .select({ userId: operatorCompetitions.userId, competitionId: operatorCompetitions.competitionId })
    .from(operatorCompetitions)
    .where(inArray(operatorCompetitions.userId, userIds));
  for (const r of rows) out.set(r.userId, [...(out.get(r.userId) ?? []), r.competitionId]);
  return out;
}

async function checkCompetitions(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return unique;
  const found = await db.select({ id: competitions.id }).from(competitions).where(inArray(competitions.id, unique));
  if (found.length !== unique.length) throw new UnknownCompetition();
  return unique.sort();
}

/** Call only after checking account-management permission in the server action. */
export async function createOperatorAccount(input: NewOperatorInput) {
  const t = await getSafeT();
  const v = makeNewOperatorSchema(t).parse(input);
  if (await db.query.users.findFirst({ where: eq(users.email, v.email), columns: { id: true } })) throw new OperatorEmailExists();
  const competitionIds = await checkCompetitions(v.competitionIds);
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(v.password);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id, name: v.name, email: v.email, active: v.active, role: "operator", passwordHash });
      if (competitionIds.length) await tx.insert(operatorCompetitions).values(competitionIds.map((competitionId) => ({ userId: id, competitionId })));
    });
  } catch (error) { if (duplicateEmail(error)) throw new OperatorEmailExists(); throw error; }
  return { id, name: v.name, email: v.email, active: v.active, competitionIds };
}

export async function updateOperatorAccount(id: string, input: EditOperatorInput) {
  const t = await getSafeT();
  const v = makeEditOperatorSchema(t).parse(input);
  const before = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, name: true, email: true, role: true, active: true } });
  if (!before || before.role !== "operator") throw new Error(t("Akun operator tidak ditemukan."));
  const existing = await db.query.users.findFirst({ where: eq(users.email, v.email), columns: { id: true } });
  if (existing && existing.id !== id) throw new OperatorEmailExists();
  const competitionIds = await checkCompetitions(v.competitionIds);
  const beforeCompetitionIds = ((await getOperatorAssignments([id])).get(id) ?? []).sort();
  const passwordHash = v.password ? await hashPassword(v.password) : undefined;
  try {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ name: v.name, email: v.email, active: v.active, ...(passwordHash ? { passwordHash } : {}) }).where(eq(users.id, id));
      await tx.delete(operatorCompetitions).where(eq(operatorCompetitions.userId, id));
      if (competitionIds.length) await tx.insert(operatorCompetitions).values(competitionIds.map((competitionId) => ({ userId: id, competitionId })));
    });
  } catch (error) { if (duplicateEmail(error)) throw new OperatorEmailExists(); throw error; }
  return {
    before: { ...before, competitionIds: beforeCompetitionIds },
    after: { id, name: v.name, email: v.email, active: v.active, passwordChanged: !!passwordHash, competitionIds },
  };
}
