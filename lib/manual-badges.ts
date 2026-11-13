import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { badges, playerBadges, tournaments, tournamentTeams } from "@/lib/db/schema";
import { getEligibleMatchPlayers } from "@/lib/queries/match-roster";
import { getSafeT } from "@/lib/i18n/server";

/** Caller authorizes badge:write. A KU has one manually selected tournament MVP. */
export async function awardTournamentMvp(input: { kuId: string; playerId: string }) {
  const t = await getSafeT();
  const v = z.object({ kuId: z.string().uuid(), playerId: z.string().uuid() }).parse(input);
  return db.transaction(async (tx) => {
    const [ku] = await tx.select().from(tournaments).where(eq(tournaments.id, v.kuId)).for("update");
    if (!ku) throw new Error(t("KU tidak ditemukan."));
    const teams = await tx.select({ clubId: tournamentTeams.clubId }).from(tournamentTeams).where(eq(tournamentTeams.tournamentId, ku.id));
    const eligible = await getEligibleMatchPlayers(ku.id, teams.map((team) => team.clubId), tx);
    const player = eligible.find((p) => p.id === v.playerId);
    if (!player) throw new Error(t("Pemain tidak terdaftar dalam KU ini."));
    await tx.insert(badges).values({ code: "mvp_tournament", name: "Pemain Terbaik Turnamen", description: "Pemain terbaik yang dipilih oleh admin atau operator.", icon: "star" })
      .onDuplicateKeyUpdate({ set: { code: "mvp_tournament" } });
    const [badge] = await tx.select().from(badges).where(eq(badges.code, "mvp_tournament"));
    const before = await tx.select({ playerId: playerBadges.playerId }).from(playerBadges).where(and(eq(playerBadges.badgeId, badge.id), eq(playerBadges.tournamentId, ku.id)));
    await tx.delete(playerBadges).where(and(eq(playerBadges.badgeId, badge.id), eq(playerBadges.tournamentId, ku.id)));
    await tx.insert(playerBadges).values({ playerId: v.playerId, badgeId: badge.id, tournamentId: ku.id, context: `manual_mvp:${ku.id}` });
    return { playerName: player.name, before };
  });
}
