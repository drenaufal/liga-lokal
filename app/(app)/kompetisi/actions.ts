"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { competitions, tournaments } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { changedSuffix, recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import { activeFormulaWeights, purgeKu } from "@/lib/ku-delete";
import { getCompetition, getCompetitionImpact } from "@/lib/queries/competition";
import { insertReturning } from "@/lib/db/returning";
import { slugify } from "@/lib/utils";

/** The four things a Turnamen is: name, season, description, organizer. */
const competitionSchema = z.object({
  name: z.string().trim().min(4, "Nama turnamen minimal 4 karakter").max(150, "Nama maksimal 150 karakter"),
  season: z
    .string()
    .trim()
    .min(4, "Musim wajib diisi, mis. 2026")
    .max(16, "Musim maksimal 16 karakter"),
  organizer: z.string().trim().max(150, "Penyelenggara maksimal 150 karakter").optional(),
  description: z.string().trim().max(2000, "Deskripsi maksimal 2000 karakter").optional(),
});

type CompetitionInput = z.infer<typeof competitionSchema>;

function toRow(v: CompetitionInput) {
  return {
    name: v.name,
    season: v.season,
    organizer: v.organizer || null,
    description: v.description || null,
  };
}

/** One Turnamen per name and season — a second one is almost certainly a double entry. */
async function nameTaken(name: string, season: string, exceptId?: string) {
  const [hit] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(
      and(
        sql`lower(${competitions.name}) = ${name.toLowerCase()}`,
        eq(competitions.season, season),
        exceptId ? ne(competitions.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return hit ? "Turnamen dengan nama dan musim ini sudah ada" : null;
}

export async function createCompetition(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser("competition:write");
  const parsed = competitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await nameTaken(row.name, row.season);
  if (taken) return formError({ name: taken }, formData);

  const [created] = await insertReturning(db, competitions, {
    ...row,
    slug: `${slugify(row.name)}-${Date.now().toString(36)}`,
    createdBy: user.id,
  });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "competition.create",
    entityType: "competition",
    entityId: created.id,
    summary: `Turnamen baru dibuat: ${row.name} (musim ${row.season})`,
  });

  revalidatePath("/kompetisi");
  revalidatePath("/command-center");
  redirect(`/kompetisi/${created.id}`);
}

export async function updateCompetition(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await actionUser("competition:write");
  const before = await getCompetition(id);
  if (!before) return { error: "Turnamen tidak ditemukan." };

  const parsed = competitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await nameTaken(row.name, row.season, id);
  if (taken) return formError({ name: taken }, formData);

  await db
    .update(competitions)
    .set({ ...row, updatedAt: new Date() })
    .where(eq(competitions.id, id));

  const labels: Record<string, string> = { name: "nama", season: "musim", organizer: "penyelenggara", description: "deskripsi" };
  const changed = (Object.keys(row) as (keyof typeof row)[]).filter(
    (k) => (before[k] ?? null) !== (row[k] ?? null),
  );
  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "competition.update",
    entityType: "competition",
    entityId: id,
    summary: `Turnamen ${row.name} diperbarui${changedSuffix(changed.map((k) => labels[k] ?? k))}`,
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, row[k]])),
  });

  // the name shows on every KU, match list and report of the Turnamen
  revalidatePath("/", "layout");
  redirect(`/kompetisi/${id}`);
}

/**
 * Deletes a Turnamen with all of its KUs. Each KU goes through purgeKu (its
 * numbers are taken back out of every player's career totals, its awards and
 * reports removed; teams, matches and events follow through the foreign keys).
 * Needs the Turnamen's name typed, and is refused while any match is in play.
 */
export async function deleteCompetition(formData: FormData) {
  const user = await actionUser("competition:delete");
  const id = String(formData.get("id"));
  const typed = String(formData.get("confirm") ?? "").trim();

  const c = await getCompetition(id);
  if (!c) throw new Error("Turnamen tidak ditemukan");
  if (typed !== c.name) throw new Error("Nama turnamen yang diketik tidak cocok");

  const impact = await getCompetitionImpact(id);
  if (impact.live > 0)
    throw new Error(`Ada ${impact.live} pertandingan yang sedang berlangsung. Akhiri dahulu sebelum menghapus turnamen.`);

  const kuIds = (await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.competitionId, id))).map(
    (k) => k.id,
  );
  const weights = await activeFormulaWeights();
  await db.transaction(async (tx) => {
    for (const kuId of kuIds) await purgeKu(tx, kuId, weights);
    await tx.delete(competitions).where(eq(competitions.id, id));
  });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "competition.delete",
    entityType: "competition",
    entityId: id,
    summary: `Turnamen "${c.name}" dihapus (${impact.kus} KU, ${impact.teams} peserta, ${impact.matches} pertandingan, ${impact.events} kejadian; statistik ${impact.players} pemain dikoreksi)`,
    before: { name: c.name, season: c.season, ...impact },
  });

  revalidatePath("/", "layout");
  redirect("/kompetisi");
}
