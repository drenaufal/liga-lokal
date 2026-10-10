/**
 * Fixture generators — pure functions. Given team identifiers they return
 * ordered fixture descriptors that the app materialises into `matches` rows.
 */

export type FixtureMatch = {
  round: number;
  stage: "league" | "group" | "knockout";
  groupLabel?: string;
  bracketSlot?: string;
  home: string | null;
  away: string | null;
  homePlaceholder?: string;
  awayPlaceholder?: string;
};

/** Round-robin via the circle method. Optionally double (home & away). */
export function roundRobin(
  teams: string[],
  opts: { doubleRound?: boolean; stage?: "league" | "group"; groupLabel?: string } = {},
): FixtureMatch[] {
  const stage = opts.stage ?? "league";
  const list = [...teams];
  if (list.length % 2 !== 0) list.push("__BYE__");
  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;
  const out: FixtureMatch[] = [];
  const rotation = [...list];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i];
      const away = rotation[n - 1 - i];
      if (home !== "__BYE__" && away !== "__BYE__") {
        // Alternate home/away for fairness across rounds
        const flip = r % 2 === 1;
        out.push({
          round: r + 1,
          stage,
          groupLabel: opts.groupLabel,
          home: flip ? away : home,
          away: flip ? home : away,
        });
      }
    }
    // rotate, keeping first fixed
    rotation.splice(1, 0, rotation.pop()!);
  }

  if (opts.doubleRound) {
    const second = out.map((m) => ({
      ...m,
      round: m.round + rounds,
      home: m.away,
      away: m.home,
    }));
    return [...out, ...second];
  }
  return out;
}

/** Group stage: split teams into groups and round-robin each. */
export function groupStage(
  teams: string[],
  groupCount: number,
  doubleRound = false,
): FixtureMatch[] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  teams.forEach((t, i) => groups[i % groupCount].push(t));
  const labels = "ABCDEFGH".split("");
  return groups.flatMap((g, gi) =>
    roundRobin(g, {
      doubleRound,
      stage: "group",
      groupLabel: labels[gi],
    }),
  );
}

/* ── Cup (single elimination) ──────────────────────────────────────────── */

export type CupStage = "round_of_32" | "round_of_16" | "quarter" | "semi" | "final";

/** One match of the bracket. Later rounds name where each side comes from until it is known. */
export type CupFixture = {
  round: number;
  stage: CupStage;
  /** "QF1", "SF2", "F1" … — also how a winner finds its next match. */
  bracketSlot: string;
  home: string | null;
  away: string | null;
  homePlaceholder?: string;
  awayPlaceholder?: string;
};

/** Bracket size → its stage and the prefix of its slot names. */
const CUP_ROUNDS: Record<number, { stage: CupStage; prefix: string }> = {
  32: { stage: "round_of_32", prefix: "R32" },
  16: { stage: "round_of_16", prefix: "R16" },
  8: { stage: "quarter", prefix: "QF" },
  4: { stage: "semi", prefix: "SF" },
  2: { stage: "final", prefix: "F" },
};

/** Slot prefixes from the first round to the final. */
const CUP_PREFIXES = ["R32", "R16", "QF", "SF", "F"] as const;

export const MAX_CUP_TEAMS = 32;

/** Standard seeding: 1 meets the last seed, 2 the second to last …, and 1 and 2 only meet in the final. */
function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/**
 * Single-elimination bracket for `teams`, best seed first. With a number of
 * teams that is not a power of two the top seeds get a bye (they skip round 1);
 * every later round starts as "Pemenang <slot>" placeholders.
 */
export function cupBracket(teams: string[]): CupFixture[] {
  const n = teams.length;
  if (n < 2) return [];
  if (n > MAX_CUP_TEAMS) throw new Error(`Maksimal ${MAX_CUP_TEAMS} tim untuk format Cup`);
  let size = 2;
  while (size < n) size *= 2;

  type Side = { team: string | null; from?: string; bye?: boolean };
  let current: Side[] = seedOrder(size).map((seed) =>
    seed <= n ? { team: teams[seed - 1] } : { team: null, bye: true },
  );

  const out: CupFixture[] = [];
  let round = 1;
  while (current.length > 1) {
    const meta = CUP_ROUNDS[current.length];
    const next: Side[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      if (a.bye || b.bye) {
        next.push(a.bye ? b : a); // the real side moves on without playing
        continue;
      }
      const slot = `${meta.prefix}${i / 2 + 1}`;
      out.push({
        round,
        stage: meta.stage,
        bracketSlot: slot,
        home: a.team,
        away: b.team,
        homePlaceholder: a.team ? undefined : `Pemenang ${a.from}`,
        awayPlaceholder: b.team ? undefined : `Pemenang ${b.from}`,
      });
      next.push({ team: null, from: slot });
    }
    current = next;
    round++;
  }
  return out;
}

/**
 * Where the winner of `slot` plays next: the slot of the following round and
 * which side of it ("QF3" → home of "SF2", "QF4" → away of "SF2"). The final
 * has no next slot.
 */
export function cupNextSlot(slot: string | null | undefined): { slot: string; side: "home" | "away" } | null {
  if (!slot) return null;
  // "R161" = round of 16, match 1: match against the known prefixes, not a regex split
  const at = CUP_PREFIXES.findIndex((p) => slot.startsWith(p) && /^\d+$/.test(slot.slice(p.length)));
  const next = at >= 0 ? CUP_PREFIXES[at + 1] : undefined;
  if (!next) return null; // unknown name, or the final
  const i = Number(slot.slice(CUP_PREFIXES[at].length));
  return { slot: `${next}${Math.ceil(i / 2)}`, side: i % 2 === 1 ? "home" : "away" };
}

/** Winner of a finished match: the higher score, or the shoot-out when level. Null while undecided. */
export function matchWinnerSide(m: {
  homeScore: number;
  awayScore: number;
  homePenalties?: number | null;
  awayPenalties?: number | null;
}): "home" | "away" | null {
  if (m.homeScore !== m.awayScore) return m.homeScore > m.awayScore ? "home" : "away";
  const hp = m.homePenalties;
  const ap = m.awayPenalties;
  if (hp == null || ap == null || hp === ap) return null;
  return hp > ap ? "home" : "away";
}

export function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    league: "Liga",
    group: "Fase Grup",
    round_of_32: "Babak 32 Besar",
    round_of_16: "Babak 16 Besar",
    quarter: "Perempat Final",
    semi: "Semifinal",
    final: "Final",
    third_place: "Perebutan Tempat Ketiga",
  };
  return map[stage] ?? stage;
}
