import { createT, type TFunction } from "@/lib/i18n/translate";

const INDONESIAN = createT("id", {});

export type ParticipationLineup = { playerId: string; clubId: string; role: "starter" | "substitute"; position?: string; slot?: string | null };
export type ParticipationEvent = { type: string; minute: number; playerId: string | null; relatedPlayerId: string | null; clubId?: string | null; createdAt?: Date | string; voided?: boolean };

/**
 * - `playing`: on the pitch
 * - `bench`: a reserve who has not played yet
 * - `subbed`: taken off in a substitution — may come back on later
 * - `off`: dismissed (red card / second yellow) — out for the rest of the match
 */
export type ParticipationState = "playing" | "bench" | "subbed" | "off";

export function orderedEvents<T extends ParticipationEvent>(events: T[]): T[] {
  return events.filter((e) => !e.voided).sort((a, b) => a.minute - b.minute ||
    (a.createdAt && b.createdAt ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() : 0));
}

/** Starting roles stay intact; the event history determines who is currently on the pitch. */
export function participationAt(lineups: ParticipationLineup[], events: ParticipationEvent[], minute = Infinity) {
  const states = new Map<string, ParticipationState>(lineups.map((l) => [l.playerId, l.role === "starter" ? "playing" : "bench"]));
  for (const e of orderedEvents(events)) {
    if (e.minute > minute) break;
    if (e.type === "substitution") {
      if (e.playerId) states.set(e.playerId, "subbed");
      if (e.relatedPlayerId) states.set(e.relatedPlayerId, "playing");
    } else if ((e.type === "red_card" || e.type === "second_yellow") && e.playerId) states.set(e.playerId, "off");
  }
  return states;
}

export function assertParticipationHistory(lineups: ParticipationLineup[], events: ParticipationEvent[], t: TFunction = INDONESIAN) {
  const history: ParticipationEvent[] = [];
  for (const e of orderedEvents(events)) {
    if (e.type === "substitution" && e.playerId && e.clubId)
      assertSubstitution(e.playerId, e.relatedPlayerId ?? undefined, e.clubId, lineups, history, e.minute, t);
    else if (e.playerId) assertPlaying(e.playerId, lineups, history, e.minute, t);
    history.push(e);
  }
}

export function assertPlaying(playerId: string, lineups: ParticipationLineup[], events: ParticipationEvent[], minute = Infinity, t: TFunction = INDONESIAN) {
  if (participationAt(lineups, events, minute).get(playerId) !== "playing")
    throw new Error(t("Pemain cadangan atau pemain yang sudah keluar tidak dapat mencatat kejadian."));
}

/**
 * The player coming on is a reserve who has not played yet, or a squad member who was substituted
 * off earlier. A dismissed player and one who is already on the pitch cannot be sent on.
 */
export function assertSubstitution(out: string, incoming: string | undefined, clubId: string, lineups: ParticipationLineup[], events: ParticipationEvent[], minute: number, t: TFunction = INDONESIAN) {
  assertPlaying(out, lineups, events, minute, t);
  const state = incoming ? participationAt(lineups, events, minute).get(incoming) : undefined;
  if (!incoming || incoming === out || !lineups.some((p) => p.playerId === incoming && p.clubId === clubId) || (state !== "bench" && state !== "subbed"))
    throw new Error(t("Pemain masuk harus dipilih dari cadangan atau pemain klub yang sudah diganti, bukan yang dikeluarkan."));
}
