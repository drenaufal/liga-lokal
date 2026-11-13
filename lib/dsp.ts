import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { ageCategories, coaches, matchDspSubmissions, matchLineups, matches, tournaments, users } from "@/lib/db/schema";
import { coachClubIds } from "@/lib/club-scope";
import { getEligibleMatchPlayers } from "@/lib/queries/match-roster";
import { createT, type TFunction } from "@/lib/i18n/translate";

const INDONESIAN = createT("id", {});
import { getSafeT } from "@/lib/i18n/server";

export const dspSchema = z.object({
  matchId: z.string().uuid(),
  /** Admin: the SSB being managed. A coach with two SSB names the one they fill; with one it is implied. */
  clubId: z.string().uuid().optional(),
  /** Admin only: the registered coach responsible for the DSP. */
  coachId: z.string().uuid().optional(),
  /** Admin only, when the SSB has no registered coach. Coaches are named from their own profile. */
  coachName: z.string().trim().min(2).max(200).optional(),
  selections: z.array(z.object({ playerId: z.string().uuid(), role: z.enum(["starter", "substitute"]) })).min(1).max(200),
});
export type DspSelection = z.infer<typeof dspSchema>["selections"][number];

export function checkDspSelections(
  selections: DspSelection[],
  eligibleIds: string[],
  rules?: { playersOnField: number; maxSquad: number } | null,
  t: TFunction = INDONESIAN,
) {
  if (new Set(selections.map((p) => p.playerId)).size !== selections.length || selections.some((p) => !eligibleIds.includes(p.playerId)))
    throw new Error(t("Pilih pemain yang terdaftar untuk klub dan KU ini."));
  const starters = selections.filter((p) => p.role === "starter").length;
  if (!starters) throw new Error(t("Pilih minimal satu starter."));
  if (rules && (starters > rules.playersOnField || selections.length > rules.maxSquad))
    throw new Error(t("Maksimal {starters} starter dan {squad} pemain sesuai aturan KU.", { starters: rules.playersOnField, squad: rules.maxSquad }));
}

/**
 * Uses the same match lock as kick-off: submission and start cannot race.
 * A coach submits for their own club under their own name; an admin may submit
 * for either club and chooses which registered coach is responsible.
 */
export async function submitDsp(userId: string, input: z.infer<typeof dspSchema>, opts?: { anyClub?: boolean }) {
  const t = await getSafeT();
  const v = dspSchema.parse(input);
  return db.transaction(async (tx) => {
    const [actor] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    const staff = actor?.role === "admin" || actor?.role === "super_admin";
    // Callers that already checked the access matrix pass `anyClub`; without it the original rule applies
    // (coaches fill their own club, admins fill either).
    const isAdmin = opts?.anyClub ?? staff;
    const permitted = opts?.anyClub !== undefined || actor?.role === "coach" || staff;
    // A coach's own SSB: the primary and the second one on their profile (users.clubId as a fallback).
    const [ownCoach] = actor && !isAdmin
      ? await tx.select({ clubId: coaches.clubId, secondClubId: coaches.secondClubId }).from(coaches).where(eq(coaches.userId, actor.id))
      : [];
    const ownClubs = coachClubIds({ clubId: ownCoach?.clubId ?? actor?.clubId, secondClubId: ownCoach?.secondClubId });
    if (!actor?.active || !permitted || (!isAdmin && !ownClubs.length))
      throw new Error(t("DSP hanya dapat diisi oleh pelatih klub terkait atau admin."));
    const clubId = isAdmin ? v.clubId : (v.clubId ?? (ownClubs.length === 1 ? ownClubs[0] : undefined));
    if (!clubId) throw new Error(t("Pilih SSB yang DSP-nya akan diisi."));
    if (!isAdmin && !ownClubs.includes(clubId)) throw new Error(t("Pertandingan ini bukan milik klub Anda."));
    const [m] = await tx.select().from(matches).where(eq(matches.id, v.matchId)).for("update");
    if (!m || m.status !== "scheduled" || m.period !== "not_started") throw new Error(t("DSP terkunci karena pertandingan sudah dimulai atau tidak terjadwal."));
    if (m.homeClubId !== clubId && m.awayClubId !== clubId) throw new Error(isAdmin ? t("SSB tersebut tidak bermain di pertandingan ini.") : t("Pertandingan ini bukan milik klub Anda."));

    let coachName: string;
    if (!isAdmin) {
      const [own] = await tx.select({ name: coaches.fullName }).from(coaches).where(eq(coaches.userId, actor.id));
      coachName = own?.name ?? actor.name;
    } else if (v.coachId) {
      const [c] = await tx.select({ name: coaches.fullName, clubId: coaches.clubId, secondClubId: coaches.secondClubId }).from(coaches).where(eq(coaches.id, v.coachId));
      if (!c || !coachClubIds(c).includes(clubId)) throw new Error(t("Pelatih tersebut tidak terdaftar di SSB ini."));
      coachName = c.name;
    } else if (v.coachName) coachName = v.coachName;
    else throw new Error(t("Pilih pelatih penanggung jawab DSP."));

    const eligible = await getEligibleMatchPlayers(m.tournamentId, [clubId], tx);
    const [ku] = await tx.select({ rules: ageCategories.rules }).from(tournaments)
      .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId)).where(eq(tournaments.id, m.tournamentId));
    checkDspSelections(v.selections, eligible.map((p) => p.id), ku?.rules, t);
    if (v.selections.filter((s) => s.role === "starter" && eligible.find((p) => p.id === s.playerId)?.position === "GK").length > 1)
      throw new Error(t("Pilih satu kiper sebagai starter; kiper lainnya dapat menjadi cadangan."));
    const opponentLineup = await tx.select().from(matchLineups).where(eq(matchLineups.matchId, m.id));
    if (v.selections.some((s) => opponentLineup.some((l) => l.clubId !== clubId && l.playerId === s.playerId)))
      throw new Error(t("Pemain sudah dipilih oleh tim lawan pada pertandingan ini."));
    const [previous] = await tx.select().from(matchDspSubmissions).where(and(eq(matchDspSubmissions.matchId, m.id), eq(matchDspSubmissions.clubId, clubId)));
    await tx.delete(matchLineups).where(and(eq(matchLineups.matchId, m.id), eq(matchLineups.clubId, clubId)));
    await tx.insert(matchLineups).values(v.selections.map((p) => ({ matchId: m.id, clubId, playerId: p.playerId, role: p.role,
      shirtNumber: eligible.find((e) => e.id === p.playerId)?.jersey, slot: eligible.find((e) => e.id === p.playerId)?.position === "GK" ? "GK" : null })));
    const submission = { submittedBy: actor.id, coachName, submittedAt: new Date() };
    if (previous) await tx.update(matchDspSubmissions).set(submission).where(eq(matchDspSubmissions.id, previous.id));
    else await tx.insert(matchDspSubmissions).values({ matchId: m.id, clubId, ...submission });
    return { tournamentId: m.tournamentId, clubId, coachName, byAdmin: isAdmin, revised: !!previous, playerCount: v.selections.length };
  });
}
