"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { submitDsp, type dspSchema } from "@/lib/dsp";
import type { z } from "zod";
import { recordAudit } from "@/lib/audit";

export async function saveDsp(input: z.infer<typeof dspSchema>) {
  const actor = await actionUser("dsp:submit");
  const result = await submitDsp(actor.id, input, { anyClub: can(actor, "dsp:any-club") });
  await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "dsp.submit", entityType: "match", entityId: input.matchId,
    summary: `${result.revised ? "Revisi" : "Submit"} DSP${result.byAdmin ? " oleh admin" : ""}: ${result.coachName}, ${result.playerCount} pemain`, after: { clubId: result.clubId, coachName: result.coachName, selections: input.selections } });
  revalidatePath("/dsp");
  revalidatePath("/match-ops", "layout");
  revalidatePath("/kompetisi", "layout");
  revalidatePath("/command-center");
}
