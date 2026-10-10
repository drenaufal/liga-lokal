"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { ageCategories, clubs, scoringFormulas, tournamentTeams, tournaments } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import { MAX_CUP_TEAMS } from "@/lib/fixtures";
import { DEFAULT_TIEBREAKERS } from "@/lib/standings";
import { kuLabel } from "@/lib/ku";
import { getCompetition } from "@/lib/queries/competition";
import { insertReturning } from "@/lib/db/returning";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

/** What makes a KU: everything except the Turnamen's own name / season / description / organizer. */
const kuSchema = z
  .object({
    ageCategoryId: z.string().min(1, "Pilih kategori usia"),
    format: z.enum(["league", "cup"], "Pilih format kompetisi"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai wajib diisi"),
    endDate: z.union([z.literal(""), date]).optional(),
    city: z.string().trim().max(120, "Kota maksimal 120 karakter").optional(),
    scoringFormulaId: z.string().optional(),
    doubleRound: z.boolean().default(false),
    clubIds: z.array(z.string()).default([]),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
  });

export async function createKu(
  competitionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await actionUser("competition:write");
  const competition = await getCompetition(competitionId);
  if (!competition) return { error: "Turnamen tidak ditemukan." };

  const parsed = kuSchema.safeParse({
    ...Object.fromEntries(formData),
    doubleRound: formData.get("doubleRound") === "on",
    clubIds: [...new Set(formData.getAll("clubIds").map(String))],
  });
  if (!parsed.success) return formError(parsed.error, formData);
  const v = parsed.data;

  const age = await db.query.ageCategories.findFirst({ where: eq(ageCategories.id, v.ageCategoryId) });
  if (!age) return formError({ ageCategoryId: "Kategori usia tidak ditemukan" }, formData);

  const already = await db.query.tournaments.findFirst({
    where: and(eq(tournaments.competitionId, competitionId), eq(tournaments.ageCategoryId, age.id)),
    columns: { id: true },
  });
  if (already) return formError({ ageCategoryId: `${age.code} sudah ada di turnamen ini` }, formData);

  if (v.scoringFormulaId) {
    const f = await db.query.scoringFormulas.findFirst({ where: eq(scoringFormulas.id, v.scoringFormulaId) });
    if (!f) return formError({ scoringFormulaId: "Formula tidak ditemukan" }, formData);
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
    return formError({ clubIds: `Maksimal ${MAX_CUP_TEAMS} SSB untuk format Cup` }, formData);
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
    summary: `KU baru dibuat: ${kuLabel(competition.name, age.code)} (${v.format === "cup" ? "Cup" : "Liga"}, ${clubIds.length} SSB)`,
  });

  revalidatePath("/kompetisi");
  revalidatePath(`/kompetisi/${competitionId}`, "layout");
  revalidatePath("/command-center");
  redirect(`/kompetisi/ku/${ku.id}`);
}
