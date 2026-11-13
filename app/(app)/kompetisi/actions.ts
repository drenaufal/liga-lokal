"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { competitions, operatorCompetitions, tournaments } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { assertCompetitionAccess } from "@/lib/competition-access";
import { auditText, changedSuffix, recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import { activeFormulaWeights, purgeKu } from "@/lib/ku-delete";
import { getCompetition, getCompetitionImpact } from "@/lib/queries/competition";
import { insertReturning } from "@/lib/db/returning";
import { slugify } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

/** The four things a Turnamen is: name, season, description, organizer. */
const makeCompetitionSchema = (t: TFunction) => z.object({
  name: z.string().trim().min(4, t("Nama turnamen minimal 4 karakter")).max(150, t("Nama maksimal 150 karakter")),
  season: z
    .string()
    .trim()
    .min(4, t("Musim wajib diisi, mis. 2026"))
    .max(16, t("Musim maksimal 16 karakter")),
  organizer: z.string().trim().max(150, t("Penyelenggara maksimal 150 karakter")).optional(),
  description: z.string().trim().max(2000, t("Deskripsi maksimal 2000 karakter")).optional(),
});

type CompetitionInput = z.infer<ReturnType<typeof makeCompetitionSchema>>;

function toRow(v: CompetitionInput) {
  return {
    name: v.name,
    season: v.season,
    organizer: v.organizer || null,
    description: v.description || null,
  };
}

/** One Turnamen per name and season — a second one is almost certainly a double entry. */
async function nameTaken(t: TFunction, name: string, season: string, exceptId?: string) {
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
  return hit ? t("Turnamen dengan nama dan musim ini sudah ada") : null;
}

export async function createCompetition(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const user = await actionUser("competition:create");
  const parsed = makeCompetitionSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await nameTaken(t, row.name, row.season);
  if (taken) return formError(t, { name: taken }, formData);

  const [created] = await insertReturning(db, competitions, {
    ...row,
    slug: `${slugify(row.name)}-${Date.now().toString(36)}`,
    createdBy: user.id,
  });
  // An operator only sees assigned Turnamen, so the one they create is assigned to them.
  if (!can(user, "scope:all-competitions")) {
    await db.insert(operatorCompetitions).values({ userId: user.id, competitionId: created.id });
  }

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "competition.create",
    entityType: "competition",
    entityId: created.id,
    summary: auditText("Turnamen baru dibuat: {name} (musim {season})", { name: row.name, season: row.season }),
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
  const t = await getT();
  const user = await actionUser("competition:edit");
  await assertCompetitionAccess(id);
  const before = await getCompetition(id);
  if (!before) return { error: t("Turnamen tidak ditemukan.") };

  const parsed = makeCompetitionSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await nameTaken(t, row.name, row.season, id);
  if (taken) return formError(t, { name: taken }, formData);

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
    summary: auditText("Turnamen {name} diperbarui{changed}", { name: row.name, changed: changedSuffix(changed.map((k) => labels[k] ?? k)) }),
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
  const t = await getT();
  const user = await actionUser("competition:delete");
  const id = String(formData.get("id"));
  await assertCompetitionAccess(id);
  const typed = String(formData.get("confirm") ?? "").trim();

  const c = await getCompetition(id);
  if (!c) throw new Error(t("Turnamen tidak ditemukan"));
  if (typed !== c.name) throw new Error(t("Nama turnamen yang diketik tidak cocok"));

  const impact = await getCompetitionImpact(id);
  if (impact.live > 0)
    throw new Error(t("Ada {n} pertandingan yang sedang berlangsung. Akhiri dahulu sebelum menghapus turnamen.", { n: impact.live }));

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
    summary: auditText('Turnamen "{name}" dihapus ({kus} KU, {teams} peserta, {matches} pertandingan, {events} kejadian; statistik {players} pemain dikoreksi)', { name: c.name, kus: impact.kus, teams: impact.teams, matches: impact.matches, events: impact.events, players: impact.players }),
    before: { name: c.name, season: c.season, ...impact },
  });

  revalidatePath("/", "layout");
  redirect("/kompetisi");
}
