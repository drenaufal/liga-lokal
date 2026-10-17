"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { playerStats, scoringFormulas, players } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { computeRating, computeScore } from "@/lib/scoring";
import type { FormulaWeights } from "@/lib/db/schema";

const weightKeys = [
  "goal", "assist", "save", "tackle", "interception", "cleanSheet",
  "keyPass", "duelWon", "yellowCard", "redCard", "minutesPer90", "motm",
] as const;

const schema = z.object({
  id: z.string(),
  name: z.string().min(3),
  description: z.string().optional(),
  weights: z.record(z.string(), z.number()),
});

export async function saveFormula(input: {
  id: string;
  name: string;
  description?: string;
  weights: Record<string, number>;
}) {
  const user = await actionUser("intelligence.formula:edit");
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("Data formula tidak valid");
  const v = parsed.data;

  const weights = Object.fromEntries(
    weightKeys.map((k) => [k, Number(v.weights[k] ?? 0)]),
  ) as unknown as FormulaWeights;

  await db
    .update(scoringFormulas)
    .set({
      name: v.name,
      description: v.description || null,
      weights,
      version: sql`${scoringFormulas.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(scoringFormulas.id, v.id));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "formula.update",
    entityType: "scoring_formula",
    entityId: v.id,
    summary: `Bobot formula "${v.name}" diperbarui`,
    after: weights as unknown as Record<string, unknown>,
  });

  revalidatePath("/player-intelligence/formula");
}

export async function activateFormula(formData: FormData) {
  const user = await actionUser("intelligence.formula:activate");
  const id = String(formData.get("id"));
  const f = await db.query.scoringFormulas.findFirst({
    where: eq(scoringFormulas.id, id),
  });
  if (!f) throw new Error("Formula tidak ditemukan");

  await db.update(scoringFormulas).set({ isActive: false });
  await db.update(scoringFormulas).set({ isActive: true }).where(eq(scoringFormulas.id, id));

  // recompute every player's score & rating under the newly active formula
  const rows = await db.select().from(playerStats);
  for (const r of rows) {
    const scorable = {
      goals: r.goals, assists: r.assists, saves: r.saves, tackles: r.tackles,
      interceptions: r.interceptions, keyPasses: r.keyPasses, duelsWon: r.duelsWon,
      cleanSheets: r.cleanSheets, yellowCards: r.yellowCards, redCards: r.redCards,
      minutesPlayed: r.minutesPlayed, motm: r.motm,
    };
    await db
      .update(playerStats)
      .set({
        score: computeScore(scorable, f.weights),
        rating: computeRating(scorable, r.appearances || 1, f.weights),
      })
      .where(eq(playerStats.id, r.id));
  }

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "formula.activate",
    entityType: "scoring_formula",
    entityId: id,
    summary: `Formula "${f.name}" diaktifkan; ${rows.length} baris statistik dihitung ulang`,
  });

  revalidatePath("/player-intelligence/formula");
  revalidatePath("/player-intelligence");
  revalidatePath("/command-center");
  revalidatePath("/", "layout");
  void players;
}
