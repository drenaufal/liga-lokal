"use server";
import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth/session";
import { awardTournamentMvp } from "@/lib/manual-badges";
import { auditText, recordAudit } from "@/lib/audit";

export async function selectBestPlayer(input: { kuId: string; playerId: string }) {
  const actor = await actionUser("intelligence.badge:select");
  const result = await awardTournamentMvp(input);
  await recordAudit({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: "badge.mvp", entityType: "tournament", entityId: input.kuId,
    summary: auditText("Pemain terbaik dipilih manual: {name}", { name: result.playerName }), before: { recipients: result.before }, after: { playerId: input.playerId } });
  revalidatePath("/player-intelligence/badge");
  revalidatePath("/registry/pemain", "layout");
}
