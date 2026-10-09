"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { tournaments, tournamentTeams } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { DEFAULT_TIEBREAKERS } from "@/lib/standings";
import { slugify } from "@/lib/utils";
import { insertReturning } from "@/lib/db/returning";

const schema = z.object({
  name: z.string().min(4, "Nama minimal 4 karakter"),
  season: z.string().min(1),
  format: z.enum(["cup", "league", "hybrid", "knockout"]),
  ageCategoryId: z.string().optional(),
  scoringFormulaId: z.string().optional(),
  host: z.string().optional(),
  city: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupCount: z.coerce.number().int().min(0).max(8).default(0),
  doubleRound: z.coerce.boolean().default(false),
  description: z.string().optional(),
  clubIds: z.array(z.string()).default([]),
});

export type TournamentFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

export async function createTournament(
  _prev: TournamentFormState,
  formData: FormData,
): Promise<TournamentFormState> {
  const user = await actionUser("competition:write");

  const raw = {
    ...Object.fromEntries(formData),
    clubIds: formData.getAll("clubIds").map(String),
    doubleRound: formData.get("doubleRound") === "on",
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Periksa kembali isian.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path[0], i.message]),
      ),
    };
  }
  const v = parsed.data;

  const [t] = await insertReturning(db, tournaments, {
      name: v.name,
      slug: `${slugify(v.name)}-${Date.now().toString(36)}`,
      season: v.season,
      format: v.format,
      status: "draft",
      ageCategoryId: v.ageCategoryId || null,
      scoringFormulaId: v.scoringFormulaId || null,
      host: v.host || null,
      city: v.city || null,
      startDate: v.startDate || null,
      endDate: v.endDate || null,
      groupCount: v.format === "cup" ? v.groupCount || 2 : 0,
      teamsPerGroup:
        v.format === "cup" && v.groupCount
          ? Math.floor(v.clubIds.length / v.groupCount)
          : 0,
      doubleRound: v.doubleRound,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tiebreakers: DEFAULT_TIEBREAKERS,
      description: v.description || null,
      createdBy: user.id,
    });

  if (v.clubIds.length) {
    await db.insert(tournamentTeams).values(
      v.clubIds.map((clubId, i) => ({
        tournamentId: t.id,
        clubId,
        groupLabel:
          v.format === "cup" && v.groupCount
            ? "ABCDEFGH"[i % v.groupCount]
            : null,
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
    entityId: t.id,
    summary: `Turnamen baru dibuat: ${t.name} (${v.format}, ${v.clubIds.length} tim)`,
  });

  revalidatePath("/kompetisi");
  redirect(`/kompetisi/${t.id}`);
}
