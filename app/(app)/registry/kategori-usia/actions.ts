"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { ageCategories, players, tournaments } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { auditText, recordAudit } from "@/lib/audit";
import { formError, requiredInt, type FormState } from "@/lib/form";
import { MAX_CATEGORY_AGE, MIN_CATEGORY_AGE } from "./shared";
import { insertReturning } from "@/lib/db/returning";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

const makeCategorySchema = (t: TFunction) => z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{1,11}$/, t("Kode 2–12 karakter, mis. KU-18")),
    label: z.string().trim().min(3, t("Nama kategori wajib diisi")),
    maxAge: requiredInt(MIN_CATEGORY_AGE, MAX_CATEGORY_AGE, t("Usia {min}–{max} tahun", { min: MIN_CATEGORY_AGE, max: MAX_CATEGORY_AGE })),
    halfDuration: requiredInt(5, 60, t("Durasi babak 5–60 menit")),
    playersOnField: requiredInt(4, 11, t("Pemain di lapangan 4–11")),
    maxSquad: requiredInt(5, 40, t("Skuad maksimal 5–40")),
    ballSize: requiredInt(3, 5, t("Ukuran bola 3–5")),
    substitutions: z.string().trim().min(2, t("Aturan pergantian wajib diisi")),
    fieldType: z.string().trim().min(2, t("Jenis lapangan wajib diisi")),
    notes: z.string().optional(),
  })
  .refine((v) => v.maxSquad >= v.playersOnField, {
    path: ["maxSquad"],
    message: t("Skuad tidak boleh lebih kecil dari jumlah pemain di lapangan"),
  });

type CategoryInput = z.infer<ReturnType<typeof makeCategorySchema>>;

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

async function codeTaken(t: TFunction, code: string, exceptId?: string) {
  const hit = await db.query.ageCategories.findFirst({
    where: exceptId
      ? and(eq(ageCategories.code, code), ne(ageCategories.id, exceptId))
      : eq(ageCategories.code, code),
    columns: { id: true },
  });
  return hit ? t("Kode {code} sudah dipakai", { code }) : null;
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
  const t = await getT();
  const user = await actionUser("registry.category:create");
  const parsed = makeCategorySchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await codeTaken(t, row.code);
  if (taken) return formError(t, { code: taken }, formData);

  const [created] = await insertReturning(db, ageCategories, { ...row, sortOrder: 999 });
  await resequence();

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "age_category.create",
    entityType: "age_category",
    entityId: created.id,
    summary: auditText("Kategori usia baru: {code} (usia maksimal {n})", { code: row.code, n: row.maxAge }),
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
  const t = await getT();
  const user = await actionUser("registry.category:edit");
  const before = await db.query.ageCategories.findFirst({ where: eq(ageCategories.id, id) });
  if (!before) return { error: t("Kategori tidak ditemukan.") };

  const parsed = makeCategorySchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await codeTaken(t, row.code, id);
  if (taken) return formError(t, { code: taken }, formData);

  await db.update(ageCategories).set(row).where(eq(ageCategories.id, id));
  await resequence();

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "age_category.update",
    entityType: "age_category",
    entityId: id,
    summary: auditText("Aturan kategori {code} diperbarui", { code: row.code }),
    before: { code: before.code, maxAge: before.maxAge, rules: before.rules },
    after: { code: row.code, maxAge: row.maxAge, rules: row.rules },
  });

  revalidateAll();
  redirect("/registry/kategori-usia");
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const t = await getT();
  const user = await actionUser("registry.category:delete");
  const cat = await db.query.ageCategories.findFirst({ where: eq(ageCategories.id, id) });
  if (!cat) return { error: t("Kategori tidak ditemukan.") };

  const [playerCount, tournamentCount] = await Promise.all([
    db.$count(players, eq(players.ageCategoryId, id)),
    db.$count(tournaments, eq(tournaments.ageCategoryId, id)),
  ]);
  if (playerCount || tournamentCount) {
    return {
      error: t("{code} masih dipakai {list}. Pindahkan dulu sebelum menghapus.", {
        code: cat.code,
        list: [
          playerCount && t("{n} pemain", { n: playerCount }),
          tournamentCount && t("{n} KU turnamen", { n: tournamentCount }),
        ]
          .filter(Boolean)
          .join(` ${t("dan")} `),
      }),
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
    summary: auditText("Kategori usia {code} dihapus", { code: cat.code }),
    before: { code: cat.code, maxAge: cat.maxAge },
  });

  revalidateAll();
  return {};
}
