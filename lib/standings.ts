import type { Tiebreaker } from "@/lib/db/schema";
import { msg, type MessageId } from "@/lib/i18n/translate";

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = [
  "points",
  "headToHead",
  "goalDifference",
  "goalsFor",
  "wins",
  "fairPlay",
];

/** Message ids — render with `t(TIEBREAKER_LABEL[tb])`. */
export const TIEBREAKER_LABEL: Record<Tiebreaker, MessageId> = {
  points: msg("Poin::urutan"),
  headToHead: msg("Head-to-head"),
  goalDifference: msg("Selisih gol"),
  goalsFor: msg("Gol memasukkan"),
  wins: msg("Jumlah kemenangan"),
  fairPlay: msg("Fair play"),
  drawLots: msg("Undian"),
};

export type MatchResultInput = {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  groupLabel?: string | null;
  homeYellow?: number;
  homeRed?: number;
  awayYellow?: number;
  awayRed?: number;
};

export type StandingRow = {
  clubId: string;
  groupLabel: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  fairPlayPoints: number;
  form: string[];
  rank: number;
};

type Config = {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: Tiebreaker[];
};

const FAIR_PLAY = { yellow: -1, secondYellow: -3, red: -3 };

/** Recompute standings from a set of completed match results. */
export function computeStandings(
  clubIds: string[],
  results: MatchResultInput[],
  config: Config,
  groupsByClub?: Record<string, string>,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const ensure = (clubId: string, group: string) => {
    if (!rows.has(clubId)) {
      rows.set(clubId, {
        clubId,
        groupLabel: group,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        fairPlayPoints: 0,
        form: [],
        rank: 0,
      });
    }
    return rows.get(clubId)!;
  };

  for (const id of clubIds) {
    ensure(id, groupsByClub?.[id] ?? "-");
  }

  // head-to-head accumulator: `${a}|${b}` -> points a earned vs b
  const h2h = new Map<string, number>();
  const h2hGd = new Map<string, number>();

  for (const r of results) {
    const group = r.groupLabel ?? groupsByClub?.[r.homeClubId] ?? "-";
    const home = ensure(r.homeClubId, group);
    const away = ensure(r.awayClubId, group);

    home.played++;
    away.played++;
    home.goalsFor += r.homeScore;
    home.goalsAgainst += r.awayScore;
    away.goalsFor += r.awayScore;
    away.goalsAgainst += r.homeScore;

    home.fairPlayPoints +=
      (r.homeYellow ?? 0) * FAIR_PLAY.yellow + (r.homeRed ?? 0) * FAIR_PLAY.red;
    away.fairPlayPoints +=
      (r.awayYellow ?? 0) * FAIR_PLAY.yellow + (r.awayRed ?? 0) * FAIR_PLAY.red;

    let hp = 0;
    let ap = 0;
    if (r.homeScore > r.awayScore) {
      home.won++;
      away.lost++;
      hp = config.pointsWin;
      ap = config.pointsLoss;
      home.form.push("M");
      away.form.push("K");
    } else if (r.homeScore < r.awayScore) {
      away.won++;
      home.lost++;
      ap = config.pointsWin;
      hp = config.pointsLoss;
      home.form.push("K");
      away.form.push("M");
    } else {
      home.drawn++;
      away.drawn++;
      hp = ap = config.pointsDraw;
      home.form.push("S");
      away.form.push("S");
    }
    home.points += hp;
    away.points += ap;

    h2h.set(
      `${r.homeClubId}|${r.awayClubId}`,
      (h2h.get(`${r.homeClubId}|${r.awayClubId}`) ?? 0) + hp,
    );
    h2h.set(
      `${r.awayClubId}|${r.homeClubId}`,
      (h2h.get(`${r.awayClubId}|${r.homeClubId}`) ?? 0) + ap,
    );
    h2hGd.set(
      `${r.homeClubId}|${r.awayClubId}`,
      (h2hGd.get(`${r.homeClubId}|${r.awayClubId}`) ?? 0) + (r.homeScore - r.awayScore),
    );
    h2hGd.set(
      `${r.awayClubId}|${r.homeClubId}`,
      (h2hGd.get(`${r.awayClubId}|${r.homeClubId}`) ?? 0) + (r.awayScore - r.homeScore),
    );
  }

  const all = [...rows.values()];
  for (const row of all) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-5);
  }

  const cmp = (a: StandingRow, b: StandingRow): number => {
    for (const tb of config.tiebreakers) {
      let d = 0;
      switch (tb) {
        case "points":
          d = b.points - a.points;
          break;
        case "goalDifference":
          d = b.goalDiff - a.goalDiff;
          break;
        case "goalsFor":
          d = b.goalsFor - a.goalsFor;
          break;
        case "wins":
          d = b.won - a.won;
          break;
        case "fairPlay":
          d = b.fairPlayPoints - a.fairPlayPoints;
          break;
        case "headToHead": {
          const ap = h2h.get(`${a.clubId}|${b.clubId}`);
          const bp = h2h.get(`${b.clubId}|${a.clubId}`);
          if (ap !== undefined && bp !== undefined) {
            d = bp - ap;
            if (d === 0) {
              d =
                (h2hGd.get(`${b.clubId}|${a.clubId}`) ?? 0) -
                (h2hGd.get(`${a.clubId}|${b.clubId}`) ?? 0);
            }
          }
          break;
        }
        default:
          d = 0;
      }
      if (d !== 0) return d;
    }
    return 0;
  };

  const byGroup = new Map<string, StandingRow[]>();
  for (const row of all) {
    if (!byGroup.has(row.groupLabel)) byGroup.set(row.groupLabel, []);
    byGroup.get(row.groupLabel)!.push(row);
  }
  for (const list of byGroup.values()) {
    list.sort(cmp);
    list.forEach((row, i) => (row.rank = i + 1));
  }

  return all.sort((a, b) => {
    if (a.groupLabel !== b.groupLabel)
      return a.groupLabel.localeCompare(b.groupLabel);
    return a.rank - b.rank;
  });
}
