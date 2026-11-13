type SquadPlayer = {
  id: string;
  name: string;
  clubId: string | null;
  secondClubId: string | null;
  position: string;
  jersey: number | null;
};

type RegisteredPlayer = Omit<SquadPlayer, "clubId" | "secondClubId"> & { clubId: string };

/** An explicit tournament squad takes precedence over current registry membership. */
export function resolveMatchSquads(
  clubIds: string[],
  registry: SquadPlayer[],
  registered: RegisteredPlayer[],
) {
  const explicit = registered.filter((p) => clubIds.includes(p.clubId));
  const registeredClubs = new Set(explicit.map((p) => p.clubId));
  const assignedPlayers = new Set(explicit.map((p) => p.id));
  const fallback = registry.flatMap((p) => {
    if (assignedPlayers.has(p.id)) return [];
    const clubId = [p.clubId, p.secondClubId].find((c) => c && clubIds.includes(c));
    if (!clubId || registeredClubs.has(clubId)) return [];
    return [{ id: p.id, name: p.name, clubId, position: p.position, jersey: p.jersey }];
  });
  return [...explicit, ...fallback];
}
