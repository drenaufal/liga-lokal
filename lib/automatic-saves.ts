import { orderedEvents, participationAt, type ParticipationEvent, type ParticipationLineup } from "./match-participation";

/** shot_on is a non-scoring shot; goals already contribute their own shot on target. */
export function withAutomaticSaves<T extends ParticipationEvent & { clubId: string | null }>(events: T[], lineups: ParticipationLineup[]) {
  const ordered = orderedEvents(events);
  const history: T[] = [];
  const saves: { type: string; minute: number; clubId: string; playerId: string; relatedPlayerId: null }[] = [];
  const legacySaves = new Map<string, number>();
  for (const e of ordered) if (e.type === "save" && e.clubId) {
    const key = `${e.clubId}:${e.minute}`;
    legacySaves.set(key, (legacySaves.get(key) ?? 0) + 1);
  }
  for (const e of ordered) {
    if (e.type === "shot_on" && e.clubId) {
      const states = participationAt(lineups, history, e.minute);
      const keepers = lineups.filter((l) => l.clubId !== e.clubId && (l.slot === "GK" || (!l.slot && l.position === "GK")) && states.get(l.playerId) === "playing");
      if (keepers.length === 1) {
        const keeper = keepers[0];
        const key = `${keeper.clubId}:${e.minute}`;
        const legacy = legacySaves.get(key) ?? 0;
        if (legacy) legacySaves.set(key, legacy - 1);
        else saves.push({ type: "save", minute: e.minute, clubId: keeper.clubId, playerId: keeper.playerId, relatedPlayerId: null });
      }
    }
    history.push(e);
  }
  return [...ordered, ...saves];
}
