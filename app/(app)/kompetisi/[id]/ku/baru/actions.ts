"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { ageCategories, clubs, scoringFormulas, tournamentTeams, tournaments } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { assertCompetitionAccess } from "@/lib/competition-access";
import { auditText, recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import { MAX_CUP_TEAMS } from "@/lib/fixtures";
import { DEFAULT_TIEBREAKERS } from "@/lib/standings";
import { kuLabel } from "@/lib/ku";
import { getCompetition } from "@/lib/queries/competition";
import { insertReturning } from "@/lib/db/returning";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

const makeDate = (t: TFunction) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("Tanggal tidak valid"));

/** What makes a KU: everything except the Turnamen's own name / season / description / organizer. */
const makeKuSchema = (t: TFunction) => z
  .object({
    ageCategoryId: z.string().min(1, t("Pilih kategori usia")),
    format: z.enum(["league", "cup"], t("Pilih format kompetisi")),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("Tanggal mulai wajib diisi")),
    endDate: z.union([z.literal(""), makeDate(t)]).optional(),
    city: z.string().trim().max(120, t("Kota maksimal 120 karakter")).optional(),
    scoringFormulaId: z.string().optional(),
    doubleRound: z.boolean().default(false),
    clubIds: z.array(z.string()).default([]),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: t("Tanggal selesai tidak boleh sebelum tanggal mulai"),
  });

export async function createKu(
  competitionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const user = await actionUser("ku:create");
  await assertCompetitionAccess(competitionId);
  const competition = await getCompetition(competitionId);
  if (!competition) return { error: t("Turnamen tidak ditemukan.") };

  const parsed = makeKuSchema(t).safeParse({
    ...Object.fromEntries(formData),
    doubleRound: formData.get("doubleRound") === "on",
    clubIds: [...new Set(formData.getAll("clubIds").map(String))],
  });
  if (!parsed.success) return formError(t, parsed.error, formData);
  const v = parsed.data;

  const age = await db.query.ageCategories.findFirst({ where: eq(ageCategories.id, v.ageCategoryId) });
  if (!age) return formError(t, { ageCategoryId: t("Kategori usia tidak ditemukan") }, formData);

  const already = await db.query.tournaments.findFirst({
    where: and(eq(tournaments.competitionId, competitionId), eq(tournaments.ageCategoryId, age.id)),
    columns: { id: true },
  });
  if (already) return formError(t, { ageCategoryId: t("{code} sudah ada di turnamen ini", { code: age.code }) }, formData);

  if (v.scoringFormulaId) {
    const f = await db.query.scoringFormulas.findFirst({ where: eq(scoringFormulas.id, v.scoringFormulaId) });
    if (!f) return formError(t, { scoringFormulaId: t("Formula tidak ditemukan") }, formData);
  }

  // only SSBs that exist and are active can take part
  const valid = v.clubIds.length
    ? new Set(
        (
          await db
            .select({ id: clubs.id })
            .from(clubs)
            .where(and(inArray(clubs.id, v.clubIds), eq(clubs.active, true)))
        ).map((c) => c.id),
      )
    : new Set<string>();
  const clubIds = v.clubIds.filter((id) => valid.has(id));
  if (v.format === "cup" && clubIds.length > MAX_CUP_TEAMS) {
    return formError(t, { clubIds: t("Maksimal {n} SSB untuk format Cup", { n: MAX_CUP_TEAMS }) }, formData);
  }

  const [ku] = await insertReturning(db, tournaments, {
    competitionId,
    ageCategoryId: age.id,
    format: v.format,
    status: "draft",
    scoringFormulaId: v.scoringFormulaId || null,
    city: v.city || null,
    startDate: v.startDate,
    endDate: v.endDate || null,
    doubleRound: v.format === "league" ? v.doubleRound : false,
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
    tiebreakers: DEFAULT_TIEBREAKERS,
    createdBy: user.id,
  });

  if (clubIds.length) {
    await db.insert(tournamentTeams).values(
      clubIds.map((clubId, i) => ({
        tournamentId: ku.id,
        clubId,
        seed: i + 1,
        registrationStatus: "registered" as const,
      })),
    );
  }

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "tournament.create",
    entityType: "tournament",
    entityId: ku.id,
    summary: auditText("KU baru dibuat: {label} ({format}, {n} SSB)", { label: kuLabel(competition.name, age.code), format: v.format === "cup" ? "Cup" : "Liga", n: clubIds.length }),
  });

  revalidatePath("/kompetisi");
  revalidatePath(`/kompetisi/${competitionId}`, "layout");
  revalidatePath("/command-center");
  redirect(`/kompetisi/ku/${ku.id}`);
}
