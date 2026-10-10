"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { ageCategories, players, tournaments } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { formError, requiredInt, type FormState } from "@/lib/form";
import { MAX_CATEGORY_AGE, MIN_CATEGORY_AGE } from "./shared";
import { insertReturning } from "@/lib/db/returning";

const categorySchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{1,11}$/, "Kode 2–12 karakter, mis. KU-18"),
    label: z.string().trim().min(3, "Nama kategori wajib diisi"),
    maxAge: requiredInt(MIN_CATEGORY_AGE, MAX_CATEGORY_AGE, `Usia ${MIN_CATEGORY_AGE}–${MAX_CATEGORY_AGE} tahun`),
    halfDuration: requiredInt(5, 60, "Durasi babak 5–60 menit"),
    playersOnField: requiredInt(4, 11, "Pemain di lapangan 4–11"),
    maxSquad: requiredInt(5, 40, "Skuad maksimal 5–40"),
    ballSize: requiredInt(3, 5, "Ukuran bola 3–5"),
    substitutions: z.string().trim().min(2, "Aturan pergantian wajib diisi"),
    fieldType: z.string().trim().min(2, "Jenis lapangan wajib diisi"),
    notes: z.string().optional(),
  })
  .refine((v) => v.maxSquad >= v.playersOnField, {
    path: ["maxSquad"],
    message: "Skuad tidak boleh lebih kecil dari jumlah pemain di lapangan",
  });

type CategoryInput = z.infer<typeof categorySchema>;

function toRow(v: CategoryInput) {
  // Eligibility is by birth year, relative to the current season year: a player
  // born in `birthYearFrom` or later (age ≤ maxAge) may play in the category.
  const year = new Date().getFullYear();
  return {
    code: v.code,
    label: v.label,
    maxAge: v.maxAge,
    birthYearFrom: year - v.maxAge,
    rules: {
      matchDuration: v.halfDuration * 2,
      halfDuration: v.halfDuration,
      playersOnField: v.playersOnField,
      maxSquad: v.maxSquad,
      substitutions: v.substitutions,
      ballSize: v.ballSize,
      fieldType: v.fieldType,
      notes: (v.notes ?? "")
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
    },
  };
}

async function codeTaken(code: string, exceptId?: string) {
  const hit = await db.query.ageCategories.findFirst({
    where: exceptId
      ? and(eq(ageCategories.code, code), ne(ageCategories.id, exceptId))
      : eq(ageCategories.code, code),
    columns: { id: true },
  });
  return hit ? `Kode ${code} sudah dipakai` : null;
}

/** Keep categories ordered youngest → oldest everywhere they are listed. */
async function resequence() {
  const rows = await db
    .select({ id: ageCategories.id, sortOrder: ageCategories.sortOrder })
    .from(ageCategories)
    .orderBy(asc(ageCategories.maxAge), asc(ageCategories.code));
  await Promise.all(
    rows.map((r, i) =>
      r.sortOrder === i
        ? null
        : db.update(ageCategories).set({ sortOrder: i }).where(eq(ageCategories.id, r.id)),
    ),
  );
}

function revalidateAll() {
  revalidatePath("/registry/kategori-usia");
  revalidatePath("/registry/pemain");
  revalidatePath("/kompetisi");
}

export async function createCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser("registry:write");
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await codeTaken(row.code);
  if (taken) return formError({ code: taken }, formData);

  const [created] = await insertReturning(db, ageCategories, { ...row, sortOrder: 999 });
  await resequence();

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "age_category.create",
    entityType: "age_category",
    entityId: created.id,
    summary: `Kategori usia baru: ${row.code} (usia maksimal ${row.maxAge})`,
    after: { ...row },
  });

  revalidateAll();
  redirect("/registry/kategori-usia");
}

export async function updateCategory(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await actionUser("registry:write");
  const before = await db.query.ageCategories.findFirst({ where: eq(ageCategories.id, id) });
  if (!before) return { error: "Kategori tidak ditemukan." };

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await codeTaken(row.code, id);
  if (taken) return formError({ code: taken }, formData);

  await db.update(ageCategories).set(row).where(eq(ageCategories.id, id));
  await resequence();

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "age_category.update",
    entityType: "age_category",
    entityId: id,
    summary: `Aturan kategori ${row.code} diperbarui`,
    before: { code: before.code, maxAge: before.maxAge, rules: before.rules },
    after: { code: row.code, maxAge: row.maxAge, rules: row.rules },
  });

  revalidateAll();
  redirect("/registry/kategori-usia");
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const user = await actionUser("registry:write");
  const cat = await db.query.ageCategories.findFirst({ where: eq(ageCategories.id, id) });
  if (!cat) return { error: "Kategori tidak ditemukan." };

  const [playerCount, tournamentCount] = await Promise.all([
    db.$count(players, eq(players.ageCategoryId, id)),
    db.$count(tournaments, eq(tournaments.ageCategoryId, id)),
  ]);
  if (playerCount || tournamentCount) {
    return {
      error: `${cat.code} masih dipakai ${[
        playerCount && `${playerCount} pemain`,
        tournamentCount && `${tournamentCount} KU turnamen`,
      ]
        .filter(Boolean)
        .join(" dan ")}. Pindahkan dulu sebelum menghapus.`,
    };
  }

  await db.delete(ageCategories).where(eq(ageCategories.id, id));
  await resequence();

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "age_category.delete",
    entityType: "age_category",
    entityId: id,
    summary: `Kategori usia ${cat.code} dihapus`,
    before: { code: cat.code, maxAge: cat.maxAge },
  });

  revalidateAll();
  return {};
}
