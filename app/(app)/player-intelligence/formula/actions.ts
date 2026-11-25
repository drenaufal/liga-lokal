"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { playerStats, scoringFormulas, players } from "@/lib/db/schema";
import { insertReturning } from "@/lib/db/returning";
import { actionUser } from "@/lib/auth/session";
import { auditText, recordAudit } from "@/lib/audit";
import { DEFAULT_WEIGHTS, computeRating, computeScore, normalizeWeights, weightsFromInput } from "@/lib/scoring";
import { getT } from "@/lib/i18n/server";

const createSchema = z.object({
  name: z.string().trim().min(3),
  description: z.string().trim().optional(),
  sourceFormulaId: z.string().optional(),
});

export async function createFormula(input: {
  name: string;
  description?: string;
  sourceFormulaId?: string;
}) {
  const t = await getT();
  const user = await actionUser("intelligence.formula:edit");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new Error(t("Data formula tidak valid"));
  const v = parsed.data;

  let weights = DEFAULT_WEIGHTS;
  if (v.sourceFormulaId) {
    const src = await db.query.scoringFormulas.findFirst({
      where: eq(scoringFormulas.id, v.sourceFormulaId),
    });
    if (!src) throw new Error(t("Formula tidak ditemukan"));
    weights = normalizeWeights(src.weights);
  }

  const [created] = await insertReturning(db, scoringFormulas, {
    name: v.name,
    description: v.description || null,
    weights,
    isActive: false,
    version: 1,
    createdBy: user.id,
  });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "formula.create",
    entityType: "scoring_formula",
    entityId: created.id,
    summary: auditText('Formula penilaian baru: "{name}"', { name: created.name }),
    after: weights as unknown as Record<string, unknown>,
  });

  revalidatePath("/player-intelligence/formula");
  return {
    id: created.id,
    name: created.name,
    description: created.description,
    weights: normalizeWeights(created.weights),
    isActive: created.isActive,
    version: created.version,
  };
}

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
  const t = await getT();
  const user = await actionUser("intelligence.formula:edit");
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(t("Data formula tidak valid"));
  const v = parsed.data;

  const weights = weightsFromInput(v.weights);

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
    summary: auditText('Bobot formula "{name}" diperbarui', { name: v.name }),
    after: weights as unknown as Record<string, unknown>,
  });

  revalidatePath("/player-intelligence/formula");
}

export async function activateFormula(formData: FormData) {
  const t = await getT();
  const user = await actionUser("intelligence.formula:activate");
  const id = String(formData.get("id"));
  const f = await db.query.scoringFormulas.findFirst({
    where: eq(scoringFormulas.id, id),
  });
  if (!f) throw new Error(t("Formula tidak ditemukan"));

  await db.update(scoringFormulas).set({ isActive: false });
  await db.update(scoringFormulas).set({ isActive: true }).where(eq(scoringFormulas.id, id));

  // recompute every player's score & rating under the newly active formula
  const weights = normalizeWeights(f.weights);
  const rows = await db.select().from(playerStats);
  for (const r of rows) {
    await db
      .update(playerStats)
      .set({
        score: computeScore(r, weights),
        rating: computeRating(r, r.appearances || 1, weights),
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
    summary: auditText('Formula "{name}" diaktifkan; {n} baris statistik dihitung ulang', { name: f.name, n: rows.length }),
  });

  revalidatePath("/player-intelligence/formula");
  revalidatePath("/player-intelligence");
  revalidatePath("/command-center");
  revalidatePath("/", "layout");
  void players;
}
