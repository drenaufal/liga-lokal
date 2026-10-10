import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { cupNextSlot, matchWinnerSide } from "@/lib/fixtures";

/** Stages that sit in a Cup bracket and have a slot name (the third-place match has none). */
const BRACKET_STAGES = ["round_of_32", "round_of_16", "quarter", "semi", "final"];

export const isCupStage = (stage: string) => BRACKET_STAGES.includes(stage);

export type AdvanceResult =
  | { status: "advanced"; to: string }
  | { status: "final" }
  /** Level on goals and no shoot-out result yet. */
  | { status: "undecided" }
  /** The winner could not be placed (the next match has already started). */
  | { status: "blocked"; reason: string }
  | { status: "not-applicable" };

/**
 * Puts the winner of a finished Cup match into the next round's match (which
 * waited as "Pemenang <slot>"). Safe to call again after a result is amended:
 * it simply overwrites the side while the next match has not started.
 */
export async function advanceCupWinner(matchId: string): Promise<AdvanceResult> {
  const m = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!m || !m.bracketSlot || !isCupStage(m.stage)) return { status: "not-applicable" };

  const side = matchWinnerSide(m);
  const winner = side === "home" ? m.homeClubId : side === "away" ? m.awayClubId : null;
  if (!winner) return { status: "undecided" };

  const next = cupNextSlot(m.bracketSlot);
  if (!next) return { status: "final" };

  const target = await db.query.matches.findFirst({
    where: and(eq(matches.tournamentId, m.tournamentId), eq(matches.bracketSlot, next.slot)),
  });
  if (!target) return { status: "not-applicable" };
  if (target.status !== "scheduled") {
    return { status: "blocked", reason: `Pertandingan ${next.slot} sudah dimulai — pemenang tidak dapat dipindahkan.` };
  }

  await db
    .update(matches)
    .set(
      next.side === "home"
        ? { homeClubId: winner, homePlaceholder: null, updatedAt: new Date() }
        : { awayClubId: winner, awayPlaceholder: null, updatedAt: new Date() },
    )
    .where(eq(matches.id, target.id));
  return { status: "advanced", to: next.slot };
}
