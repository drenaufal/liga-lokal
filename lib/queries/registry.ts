import { and, asc, count, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ageCategories,
  badges,
  clubs,
  coaches,
  matchEvents,
  matchLineups,
  matches,
  playerBadges,
  players,
  playerSeasonHistory,
  playerStats,
  referees,
  standings,
  tournamentSquad,
  tournamentTeams,
  tournaments,
  venues,
} from "@/lib/db/schema";
import { alias } from "drizzle-orm/mysql-core";
import { LICENSE_EXPIRING_DAYS } from "@/lib/status";
import { expandPosition, positionLine, rolesOfLine } from "@/lib/positions";
import { sumStats, type StatTotals } from "@/lib/player-stats";
import { ascNullsLast, descNullsFirst } from "@/lib/db/order";

export type PlayerListParams = {
  q?: string;
  club?: string;
  age?: string;
  position?: string;
  verification?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const PAGE_SIZE = 20;

export async function listPlayers(params: PlayerListParams) {
  const sc = alias(clubs, "sc");
  const page = Math.max(1, Number(params.page) || 1);
  const conds: SQL[] = [];

  if (params.q) {
    conds.push(
      or(
        like(players.fullName, `%${params.q}%`),
        like(players.registrationNo, `%${params.q}%`),
        like(players.nickname, `%${params.q}%`),
        like(players.nisn, `%${params.q}%`),
      )!,
    );
  }
  if (params.club)
    conds.push(or(eq(players.clubId, params.club), eq(players.secondClubId, params.club))!);
  if (params.age) conds.push(eq(players.ageCategoryId, params.age));
  const roles = expandPosition(params.position);
  if (roles.length) conds.push(inArray(players.position, roles));
  if (params.verification)
    conds.push(
      eq(
        players.verificationStatus,
        params.verification as "verified" | "flagged" | "pending" | "rejected",
      ),
    );

  const where = conds.length ? and(...conds) : undefined;

  const sortCol =
    params.sort === "name"
      ? players.fullName
      : params.sort === "club"
        ? clubs.name
        : params.sort === "age"
          ? ageCategories.sortOrder
          : params.sort === "created"
            ? players.createdAt
            : players.fullName;
  const dir = params.dir === "desc" ? desc : asc;

  const [rows, totalRes, filterData] = await Promise.all([
    db
      .select({
        id: players.id,
        fullName: players.fullName,
        nickname: players.nickname,
        registrationNo: players.registrationNo,
        nisn: players.nisn,
        photoUrl: players.photoUrl,
        docs: sql<number>`(${players.kiaUrl} is not null) + (${players.kkUrl} is not null) + (${players.aktaUrl} is not null) + (${players.ijazahUrl} is not null) + (${players.raporUrl} is not null)`,
        foot: players.foot,
        position: players.position,
        jerseyNumber: players.jerseyNumber,
        verificationStatus: players.verificationStatus,
        dob: players.dob,
        clubName: clubs.name,
        clubShort: clubs.shortName,
        clubColor: clubs.primaryColor,
        secondClubName: sc.name,
        secondClubShort: sc.shortName,
        secondClubColor: sc.primaryColor,
        ageCode: ageCategories.code,
      })
      .from(players)
      .leftJoin(clubs, eq(clubs.id, players.clubId))
      .leftJoin(sc, eq(sc.id, players.secondClubId))
      .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
      .where(where)
      .orderBy(dir(sortCol))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(players).where(where),
    getRegistryFilters(),
  ]);

  return {
    rows,
    total: totalRes[0].n,
    page,
    pageSize: PAGE_SIZE,
    filters: filterData,
  };
}

export async function getRegistryFilters() {
  const [cl, ag] = await Promise.all([
    db
      .select({ id: clubs.id, name: clubs.name })
      .from(clubs)
      .orderBy(asc(clubs.name)),
    db
      .select({
        id: ageCategories.id,
        code: ageCategories.code,
        birthYearFrom: ageCategories.birthYearFrom,
        birthYearTo: ageCategories.birthYearTo,
      })
      .from(ageCategories)
      .orderBy(asc(ageCategories.sortOrder)),
  ]);
  return { clubs: cl, ageCategories: ag };
}

export async function getPlayer(id: string) {
  return (await db.query.players.findFirst({ where: eq(players.id, id) })) ?? null;
}

export type ClubChip = {
  id: string;
  name: string;
  short: string;
  color: string | null;
  /** Where the player is registered: primary club, second club, or only seen in older stats. */
  tag: "utama" | "kedua" | "riwayat";
};

/**
 * Player profile. `clubFilter` narrows the statistics to one club (the
 * tournaments played for it); without it they accumulate across every club.
 */
export async function getPlayerProfile(id: string, clubFilter?: string) {
  const [row] = await db
    .select({ player: players, club: clubs, homeVenue: venues, ageCategory: ageCategories })
    .from(players)
    .leftJoin(clubs, eq(clubs.id, players.clubId))
    .leftJoin(venues, eq(venues.id, clubs.homeVenueId))
    .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
    .where(eq(players.id, id));
  if (!row) return null;

  const [badgeRows, seasonHistory, secondClubRows, statRows] = await Promise.all([
    db
      .select({ playerBadge: playerBadges, badge: badges })
      .from(playerBadges)
      .innerJoin(badges, eq(badges.id, playerBadges.badgeId))
      .where(eq(playerBadges.playerId, id)),
    db.select().from(playerSeasonHistory).where(eq(playerSeasonHistory.playerId, id)),
    row.player.secondClubId
      ? db.select().from(clubs).where(eq(clubs.id, row.player.secondClubId))
      : Promise.resolve([]),
    db
      .select({
        stat: playerStats,
        tournamentName: tournaments.name,
        tournamentStatus: tournaments.status,
        tournamentStart: tournaments.startDate,
        clubName: clubs.name,
        clubShort: clubs.shortName,
        clubColor: clubs.primaryColor,
      })
      .from(playerStats)
      .leftJoin(tournaments, eq(tournaments.id, playerStats.tournamentId))
      .leftJoin(clubs, eq(clubs.id, playerStats.clubId))
      .where(eq(playerStats.playerId, id)),
  ]);
  const secondClub = secondClubRows[0] ?? null;

  const player = {
    ...row.player,
    club: row.club && { ...row.club, homeVenue: row.homeVenue },
    secondClub,
    ageCategory: row.ageCategory,
    badges: badgeRows.map((b) => ({ ...b.playerBadge, badge: b.badge })),
    seasonHistory,
  };

  const careerRow = statRows.find((r) => !r.stat.tournamentId && r.stat.season === "career")?.stat;
  const tournamentRows = statRows
    .filter((r) => r.stat.tournamentId)
    .sort((a, b) => String(b.tournamentStart ?? "").localeCompare(String(a.tournamentStart ?? "")));

  // Filter chips: registered clubs first, then any other club found in the stats.
  const chips: ClubChip[] = [];
  const addChip = (c: ClubChip) => {
    if (!chips.some((x) => x.id === c.id)) chips.push(c);
  };
  if (row.club)
    addChip({ id: row.club.id, name: row.club.name, short: row.club.shortName, color: row.club.primaryColor, tag: "utama" });
  if (secondClub)
    addChip({ id: secondClub.id, name: secondClub.name, short: secondClub.shortName, color: secondClub.primaryColor, tag: "kedua" });
  for (const r of tournamentRows) {
    if (r.stat.clubId && r.clubName)
      addChip({ id: r.stat.clubId, name: r.clubName, short: r.clubShort ?? "", color: r.clubColor, tag: "riwayat" });
  }

  const selectedClub = clubFilter && chips.some((c) => c.id === clubFilter) ? clubFilter : null;
  const scopedRows = selectedClub
    ? tournamentRows.filter((r) => r.stat.clubId === selectedClub)
    : tournamentRows;

  // "Semua" keeps the stored career line (what leaderboards use); a single
  // club adds up the tournaments played for it.
  const totals: StatTotals | undefined = selectedClub
    ? sumStats(scopedRows.map((r) => r.stat))
    : (careerRow ?? (tournamentRows.length ? sumStats(tournamentRows.map((r) => r.stat)) : undefined));

  const history = selectedClub
    ? seasonHistory.filter((h) => h.clubId === selectedClub)
    : seasonHistory;

  // Percentile context: same line + age category. Only meaningful for the
  // all-clubs line, which is what the pool's career rows are.
  const line = rolesOfLine(positionLine(player.position));
  const peers = await db
    .select({ score: playerStats.score, goals: playerStats.goals })
    .from(playerStats)
    .innerJoin(players, eq(players.id, playerStats.playerId))
    .where(
      and(
        eq(playerStats.season, "career"),
        inArray(players.position, [...line]),
        player.ageCategoryId ? eq(players.ageCategoryId, player.ageCategoryId) : sql`true`,
      ),
    );

  return {
    player: { ...player, seasonHistory: history },
    clubChips: chips,
    selectedClub,
    totals,
    tournaments: scopedRows.map((r) => ({
      ...r.stat,
      tournamentName: r.tournamentName,
      tournamentStatus: r.tournamentStatus,
      clubName: r.clubName,
      clubShort: r.clubShort,
      clubColor: r.clubColor,
    })),
    peers,
  };
}

/** One match of a player's club in a tournament, with what the player did in it. */
export type PlayerMatchRow = {
  id: string;
  scheduledAt: Date;
  status: string;
  stage: string;
  round: number;
  groupLabel: string | null;
  resultStatus: string;
  isHome: boolean;
  opponentName: string | null;
  opponentShort: string | null;
  opponentColor: string | null;
  opponentLogo: string | null;
  scoreFor: number;
  scoreAgainst: number;
  /** Starter / substitute when a line-up exists for the match. */
  lineupRole: "starter" | "substitute" | null;
  tally: {
    goals: number;
    ownGoals: number;
    assists: number;
    shotsOn: number;
    shotsOff: number;
    saves: number;
    interceptions: number;
    yellow: number;
    red: number;
  };
  /** Chronological actions, for the little chips next to each match. */
  actions: { type: string; minute: number }[];
  involved: boolean;
};

/** The "click a competition" drill-down: every match the player's club played there. */
export async function getPlayerTournamentDetail(playerId: string, tournamentId: string) {
  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      photoUrl: players.photoUrl,
      position: players.position,
      jerseyNumber: players.jerseyNumber,
      clubId: players.clubId,
      secondClubId: players.secondClubId,
    })
    .from(players)
    .where(eq(players.id, playerId));
  if (!player) return null;

  const [t] = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
      format: tournaments.format,
      season: tournaments.season,
      ageCode: ageCategories.code,
    })
    .from(tournaments)
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(eq(tournaments.id, tournamentId));
  if (!t) return null;

  const [statRow] = await db
    .select({
      stat: playerStats,
      clubName: clubs.name,
      clubShort: clubs.shortName,
      clubColor: clubs.primaryColor,
    })
    .from(playerStats)
    .leftJoin(clubs, eq(clubs.id, playerStats.clubId))
    .where(and(eq(playerStats.playerId, playerId), eq(playerStats.tournamentId, tournamentId)));

  // The club he represented: from the stats, else the club of his tournament squad, else his own.
  let clubId = statRow?.stat.clubId ?? null;
  if (!clubId) {
    const [sq] = await db
      .select({ clubId: tournamentTeams.clubId })
      .from(tournamentSquad)
      .innerJoin(tournamentTeams, eq(tournamentTeams.id, tournamentSquad.tournamentTeamId))
      .where(and(eq(tournamentSquad.playerId, playerId), eq(tournamentTeams.tournamentId, tournamentId)));
    clubId = sq?.clubId ?? player.clubId;
  }
  if (!clubId)
    return { player, tournament: t, stat: statRow?.stat ?? null, club: null, matches: [] as PlayerMatchRow[] };

  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId));

  const hc = alias(clubs, "hc");
  const ac = alias(clubs, "ac");
  const ms = await db
    .select({
      id: matches.id,
      scheduledAt: matches.scheduledAt,
      status: matches.status,
      stage: matches.stage,
      round: matches.round,
      groupLabel: matches.groupLabel,
      resultStatus: matches.resultStatus,
      homeClubId: matches.homeClubId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeName: hc.name,
      homeShort: hc.shortName,
      homeColor: hc.primaryColor,
      homeLogo: hc.logoUrl,
      awayName: ac.name,
      awayShort: ac.shortName,
      awayColor: ac.primaryColor,
      awayLogo: ac.logoUrl,
    })
    .from(matches)
    .leftJoin(hc, eq(hc.id, matches.homeClubId))
    .leftJoin(ac, eq(ac.id, matches.awayClubId))
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        or(eq(matches.homeClubId, clubId), eq(matches.awayClubId, clubId)),
        inArray(matches.status, ["completed", "live", "halftime"]),
      ),
    )
    .orderBy(asc(matches.scheduledAt));

  const ids = ms.map((m) => m.id);
  const [events, lineups] = ids.length
    ? await Promise.all([
        db
          .select({ matchId: matchEvents.matchId, type: matchEvents.type, minute: matchEvents.minute })
          .from(matchEvents)
          .where(
            and(
              inArray(matchEvents.matchId, ids),
              eq(matchEvents.playerId, playerId),
              eq(matchEvents.voided, false),
            ),
          )
          .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt)),
        db
          .select({ matchId: matchLineups.matchId, role: matchLineups.role })
          .from(matchLineups)
          .where(and(inArray(matchLineups.matchId, ids), eq(matchLineups.playerId, playerId))),
      ])
    : [[], []];

  const rows: PlayerMatchRow[] = ms.map((m) => {
    const isHome = m.homeClubId === clubId;
    const evs = events.filter((e) => e.matchId === m.id);
    const count = (...types: string[]) => evs.filter((e) => types.includes(e.type)).length;
    const lineup = lineups.find((l) => l.matchId === m.id);
    return {
      id: m.id,
      scheduledAt: m.scheduledAt,
      status: m.status,
      stage: m.stage,
      round: m.round,
      groupLabel: m.groupLabel,
      resultStatus: m.resultStatus,
      isHome,
      opponentName: isHome ? m.awayName : m.homeName,
      opponentShort: isHome ? m.awayShort : m.homeShort,
      opponentColor: isHome ? m.awayColor : m.homeColor,
      opponentLogo: isHome ? m.awayLogo : m.homeLogo,
      scoreFor: isHome ? m.homeScore : m.awayScore,
      scoreAgainst: isHome ? m.awayScore : m.homeScore,
      lineupRole: lineup?.role ?? null,
      tally: {
        goals: count("goal", "penalty_goal"),
        ownGoals: count("own_goal"),
        assists: count("assist"),
        shotsOn: count("shot_on"),
        shotsOff: count("shot_off"),
        saves: count("save"),
        interceptions: count("interception"),
        yellow: count("yellow_card", "second_yellow"),
        red: count("red_card"),
      },
      actions: evs
        .filter((e) => e.type !== "var_check" && e.type !== "period")
        .map((e) => ({ type: e.type, minute: e.minute })),
      involved: evs.length > 0 || !!lineup,
    };
  });

  return { player, tournament: t, stat: statRow?.stat ?? null, club, matches: rows };
}

/* ─────────────────────────── Clubs ──────────────────────────────── */

export async function listClubs(params: { q?: string; type?: string; city?: string }) {
  const conds: SQL[] = [];
  if (params.q)
    conds.push(
      or(like(clubs.name, `%${params.q}%`), like(clubs.shortName, `%${params.q}%`))!,
    );
  if (params.type) conds.push(eq(clubs.type, params.type as "club" | "academy"));
  if (params.city) conds.push(eq(clubs.city, params.city));

  const rows = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      shortName: clubs.shortName,
      type: clubs.type,
      city: clubs.city,
      province: clubs.province,
      foundedYear: clubs.foundedYear,
      logoUrl: clubs.logoUrl,
      primaryColor: clubs.primaryColor,
      accreditation: clubs.accreditation,
      venue: venues.name,
      squadSize: sql<number>`(select count(*) from ${players} p where p.club_id = ${clubs.id} or p.second_club_id = ${clubs.id})`,
    })
    .from(clubs)
    .leftJoin(venues, eq(venues.id, clubs.homeVenueId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(clubs.name));

  const cities = await db
    .selectDistinct({ city: clubs.city })
    .from(clubs)
    .orderBy(asc(clubs.city));

  return { rows, cities: cities.map((c) => c.city) };
}

export async function getClubProfile(id: string) {
  const [row] = await db
    .select({ club: clubs, homeVenue: venues })
    .from(clubs)
    .leftJoin(venues, eq(venues.id, clubs.homeVenueId))
    .where(eq(clubs.id, id));
  if (!row) return null;
  const club = { ...row.club, homeVenue: row.homeVenue };

  const squad = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      position: players.position,
      jerseyNumber: players.jerseyNumber,
      photoUrl: players.photoUrl,
      verificationStatus: players.verificationStatus,
      isSecondClub: sql<number>`(${players.secondClubId} = ${id})`,
      ageCode: ageCategories.code,
      goals: sql<number>`coalesce((select sum(goals) from ${playerStats} ps where ps.player_id = ${players.id} and ps.season <> 'career'),0)`,
      apps: sql<number>`coalesce((select sum(appearances) from ${playerStats} ps where ps.player_id = ${players.id} and ps.season <> 'career'),0)`,
    })
    .from(players)
    .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
    .where(or(eq(players.clubId, id), eq(players.secondClubId, id)))
    .orderBy(asc(ageCategories.sortOrder), ascNullsLast(players.jerseyNumber));

  const comps = await db
    .select({
      tournamentId: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
      format: tournaments.format,
      season: tournaments.season,
      regStatus: tournamentTeams.registrationStatus,
      group: tournamentTeams.groupLabel,
      played: standings.played,
      won: standings.won,
      drawn: standings.drawn,
      lost: standings.lost,
      points: standings.points,
      rank: standings.rank,
    })
    .from(tournamentTeams)
    .innerJoin(tournaments, eq(tournaments.id, tournamentTeams.tournamentId))
    .leftJoin(
      standings,
      and(
        eq(standings.tournamentId, tournaments.id),
        eq(standings.clubId, id),
      ),
    )
    .where(eq(tournamentTeams.clubId, id))
    .orderBy(descNullsFirst(tournaments.startDate));

  const hc = alias(clubs, "hc");
  const ac = alias(clubs, "ac");
  const recentMatches = await db
    .select({
      id: matches.id,
      scheduledAt: matches.scheduledAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeClubId: matches.homeClubId,
      homeShort: hc.shortName,
      awayShort: ac.shortName,
      tournament: tournaments.name,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .leftJoin(hc, eq(hc.id, matches.homeClubId))
    .leftJoin(ac, eq(ac.id, matches.awayClubId))
    .where(or(eq(matches.homeClubId, id), eq(matches.awayClubId, id)))
    .orderBy(desc(matches.scheduledAt))
    .limit(8);

  const staff = await db
    .select({
      id: coaches.id,
      fullName: coaches.fullName,
      photoUrl: coaches.photoUrl,
      specialty: coaches.specialty,
      licenseLevel: coaches.licenseLevel,
      status: coachLiveStatus,
    })
    .from(coaches)
    .where(eq(coaches.clubId, id))
    .orderBy(ascNullsLast(coaches.specialty), asc(coaches.fullName));

  return { club, squad, comps, recentMatches, staff };
}

/** Home-venue options for the club create / edit form. */
export async function getClubFormOptions() {
  return db
    .select({ id: venues.id, name: venues.name, city: venues.city })
    .from(venues)
    .orderBy(asc(venues.name));
}

export async function getClub(id: string) {
  return (await db.query.clubs.findFirst({ where: eq(clubs.id, id) })) ?? null;
}

/* ─────────────────────────── Coaches ────────────────────────────── */

/**
 * License status derived live from the expiry date, so the list never shows a
 * stale "Aktif" once a license lapses. `revoked` is the only stored override.
 */
const coachLiveStatus = sql<"active" | "expiring" | "expired" | "revoked">`case
  when ${coaches.status} = 'revoked' then 'revoked'
  when ${coaches.licenseExpiry} < current_date then 'expired'
  when ${coaches.licenseExpiry} < current_date + interval ${sql.raw(String(LICENSE_EXPIRING_DAYS))} day then 'expiring'
  else 'active' end`;

export async function listCoaches(params: {
  q?: string;
  status?: string;
  level?: string;
  club?: string;
}) {
  const conds: SQL[] = [];
  if (params.q)
    conds.push(
      or(like(coaches.fullName, `%${params.q}%`), like(coaches.licenseNumber, `%${params.q}%`))!,
    );
  if (params.status) conds.push(sql`${coachLiveStatus} = ${params.status}`);
  if (params.level) conds.push(eq(coaches.licenseLevel, params.level));
  if (params.club) conds.push(eq(coaches.clubId, params.club));

  return db
    .select({
      id: coaches.id,
      fullName: coaches.fullName,
      photoUrl: coaches.photoUrl,
      specialty: coaches.specialty,
      licenseLevel: coaches.licenseLevel,
      licenseNumber: coaches.licenseNumber,
      licenseExpiry: coaches.licenseExpiry,
      experienceYears: coaches.experienceYears,
      status: coachLiveStatus,
      clubId: clubs.id,
      clubName: clubs.name,
      clubShort: clubs.shortName,
      clubColor: clubs.primaryColor,
      clubLogo: clubs.logoUrl,
    })
    .from(coaches)
    .leftJoin(clubs, eq(clubs.id, coaches.clubId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(coaches.fullName));
}

export async function getCoach(id: string) {
  return (await db.query.coaches.findFirst({ where: eq(coaches.id, id) })) ?? null;
}

export async function getCoachProfile(id: string) {
  const [coach] = await db
    .select({ coach: coaches, status: coachLiveStatus })
    .from(coaches)
    .where(eq(coaches.id, id));
  if (!coach) return null;

  const club = coach.coach.clubId
    ? ((await db.query.clubs.findFirst({ where: eq(clubs.id, coach.coach.clubId) })) ?? null)
    : null;

  let recentMatches: {
    id: string;
    scheduledAt: Date;
    status: string;
    homeShort: string | null;
    awayShort: string | null;
    homeScore: number;
    awayScore: number;
    tournament: string;
  }[] = [];
  let squadSize = 0;
  if (club) {
    const hc = alias(clubs, "hc");
    const ac = alias(clubs, "ac");
    [recentMatches, squadSize] = await Promise.all([
      db
        .select({
          id: matches.id,
          scheduledAt: matches.scheduledAt,
          status: matches.status,
          homeShort: hc.shortName,
          awayShort: ac.shortName,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
          tournament: tournaments.name,
        })
        .from(matches)
        .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
        .leftJoin(hc, eq(hc.id, matches.homeClubId))
        .leftJoin(ac, eq(ac.id, matches.awayClubId))
        .where(or(eq(matches.homeClubId, club.id), eq(matches.awayClubId, club.id)))
        .orderBy(desc(matches.scheduledAt))
        .limit(10),
      db.$count(players, or(eq(players.clubId, club.id), eq(players.secondClubId, club.id))),
    ]);
  }

  return { coach: { ...coach.coach, status: coach.status }, club, recentMatches, squadSize };
}

/* ─────────────────────────── Referees ───────────────────────────── */

export async function listReferees(params: { q?: string; status?: string; level?: string }) {
  const conds: SQL[] = [];
  if (params.q) conds.push(like(referees.fullName, `%${params.q}%`));
  if (params.status)
    conds.push(
      eq(referees.status, params.status as "active" | "expiring" | "expired" | "revoked"),
    );
  if (params.level) conds.push(eq(referees.licenseLevel, params.level));

  return db
    .select()
    .from(referees)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(referees.fullName));
}

export async function getRefereeProfile(id: string) {
  const referee = await db.query.referees.findFirst({ where: eq(referees.id, id) });
  if (!referee) return null;
  const hc = alias(clubs, "hc");
  const ac = alias(clubs, "ac");
  const assignments = await db
    .select({
      id: matches.id,
      scheduledAt: matches.scheduledAt,
      status: matches.status,
      homeShort: hc.shortName,
      awayShort: ac.shortName,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      tournament: tournaments.name,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .leftJoin(hc, eq(hc.id, matches.homeClubId))
    .leftJoin(ac, eq(ac.id, matches.awayClubId))
    .where(eq(matches.refereeId, id))
    .orderBy(desc(matches.scheduledAt))
    .limit(12);
  return { referee, assignments };
}

/* ─────────────────────────── Venues ─────────────────────────────── */

export async function listVenues(params: { q?: string; surface?: string }) {
  const conds: SQL[] = [];
  if (params.q)
    conds.push(or(like(venues.name, `%${params.q}%`), like(venues.city, `%${params.q}%`))!);
  if (params.surface)
    conds.push(
      eq(venues.surface, params.surface as "natural" | "artificial" | "hybrid" | "futsal"),
    );

  return db
    .select({
      id: venues.id,
      name: venues.name,
      city: venues.city,
      province: venues.province,
      capacity: venues.capacity,
      fieldCount: venues.fieldCount,
      surface: venues.surface,
      floodlights: venues.floodlights,
      photoUrl: venues.photoUrl,
      clubs: sql<number>`(select count(*) from ${clubs} c where c.home_venue_id = ${venues.id})`,
      matches: sql<number>`(select count(*) from ${matches} m where m.venue_id = ${venues.id})`,
    })
    .from(venues)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(venues.name));
}

export async function listAgeCategories() {
  return db
    .select({
      category: ageCategories,
      // Qualify the outer id explicitly: in a join-less select Drizzle renders
      // columns unqualified, and a bare "id" would bind to the subquery's table.
      players: sql<number>`(select count(*) from ${players} p where p.age_category_id = ${ageCategories}.id)`,
      tournaments: sql<number>`(select count(*) from ${tournaments} t where t.age_category_id = ${ageCategories}.id)`,
    })
    .from(ageCategories)
    .orderBy(asc(ageCategories.sortOrder));
}

export async function getAgeCategory(id: string) {
  return (await db.query.ageCategories.findFirst({ where: eq(ageCategories.id, id) })) ?? null;
}
