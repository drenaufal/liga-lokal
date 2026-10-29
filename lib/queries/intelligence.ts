import { and, asc, count, desc, eq, gte, like, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { expandPosition, positionLine, rolesOfLine } from "@/lib/positions";
import { pageWindow, parsePlayerFilters, paramValue, parsePagination, type IntelligenceParams } from "@/lib/intelligence-filters";
import {
  ageCategories,
  badges,
  clubs,
  competitions,
  playerBadges,
  players,
  playerStats,
  tournaments,
  tournamentTeams,
} from "@/lib/db/schema";
import { getEligibleMatchPlayers } from "@/lib/queries/match-roster";
import { clubScopeFilter, playerScopeFilter } from "@/lib/club-scope";
import { getSafeT } from "@/lib/i18n/server";

/** `scope`: the SSB the viewer may see (`getClubScope`); `null` means every SSB. */
function playerConditions(filter: ReturnType<typeof parsePlayerFilters>, scope: string[] | null = null) {
  const conds: SQL[] = [eq(playerStats.season, "career"), gte(playerStats.appearances, filter.minApps), gte(playerStats.rating, filter.minRating)];
  const scoped = playerScopeFilter(scope);
  if (scoped) conds.push(scoped);
  if (filter.q) conds.push(like(players.fullName, `%${filter.q}%`));
  const roles = expandPosition(filter.position);
  if (roles.length) conds.push(inArray(players.position, roles));
  if (filter.age) conds.push(eq(ageCategories.code, filter.age));
  if (filter.club) conds.push(eq(players.clubId, filter.club));
  return and(...conds);
}

export async function getPlayerFilterOptions(scope: string[] | null = null) {
  const [ages, clubRows] = await Promise.all([
    db.select({ code: ageCategories.code }).from(ageCategories).orderBy(asc(ageCategories.sortOrder)),
    db.select({ id: clubs.id, name: clubs.name }).from(clubs).where(clubScopeFilter(clubs.id, scope)).orderBy(asc(clubs.name)),
  ]);
  return { ages, clubs: clubRows };
}

export async function searchPlayersForRadar(params: IntelligenceParams = {}, scope: string[] | null = null) {
  const filter = parsePlayerFilters(params);
  const where = playerConditions(filter, scope);
  const [{ total }] = await db.select({ total: count() }).from(playerStats)
    .innerJoin(players, eq(players.id, playerStats.playerId))
    .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId)).where(where);
  const pagination = pageWindow(total, filter.page, filter.pageSize);
  const columns = {
    name: players.fullName, score: playerStats.score, rating: playerStats.rating,
    appearances: playerStats.appearances, minutesPlayed: playerStats.minutesPlayed,
    goals: playerStats.goals, assists: playerStats.assists, shotsOnTarget: playerStats.shotsOnTarget,
    saves: playerStats.saves, interceptions: playerStats.interceptions, shotsOffTarget: playerStats.shotsOffTarget,
    redCards: playerStats.redCards, yellowCards: playerStats.yellowCards,
  };
  const orderBy = filter.order === "asc" ? asc(columns[filter.sort]) : desc(columns[filter.sort]);

  const rows = await db
    .select({
      id: players.id,
      name: players.fullName,
      club: clubs.shortName,
      position: players.position,
      ageCode: ageCategories.code,
      photoUrl: players.photoUrl,
      goals: playerStats.goals,
      assists: playerStats.assists,
      appearances: playerStats.appearances,
      score: playerStats.score,
      rating: playerStats.rating,
    })
    .from(playerStats)
    .innerJoin(players, eq(players.id, playerStats.playerId))
    .leftJoin(clubs, eq(clubs.id, players.clubId))
    .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
    .where(where)
    .orderBy(orderBy, asc(players.fullName), asc(players.id))
    .limit(pagination.pageSize).offset(pagination.offset);
  return { rows, ...pagination };
}

export async function getPlayerRadarData(ids: string[], scope: string[] | null = null) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: players.id,
      name: players.fullName,
      club: clubs.shortName,
      position: players.position,
      ageCode: ageCategories.code,
      ageCategoryId: players.ageCategoryId,
      photoUrl: players.photoUrl,
      stat: playerStats,
    })
    .from(players)
    .leftJoin(clubs, eq(clubs.id, players.clubId))
    .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
    .innerJoin(
      playerStats,
      and(eq(playerStats.playerId, players.id), eq(playerStats.season, "career")),
    )
    .where(and(inArray(players.id, ids), playerScopeFilter(scope)));
  return rows;
}

export async function getPeerPool(position: string, ageCategoryId: string | null) {
  return db
    .select({
      minutesPlayed: playerStats.minutesPlayed,
      goals: playerStats.goals,
      assists: playerStats.assists,
      keyPasses: playerStats.keyPasses,
      tackles: playerStats.tackles,
      interceptions: playerStats.interceptions,
      saves: playerStats.saves,
      score: playerStats.score,
    })
    .from(playerStats)
    .innerJoin(players, eq(players.id, playerStats.playerId))
    .where(
      and(
        eq(playerStats.season, "career"),
        sql`${playerStats.appearances} > 0`,
        inArray(players.position, [...rolesOfLine(positionLine(position))]),
        ageCategoryId ? eq(players.ageCategoryId, ageCategoryId) : sql`true`,
      ),
    );
}

/**
 * The badge gallery. Awards belong to a KU (a row of `tournaments`), so they
 * are counted per Turnamen and per KU: `competitionId` narrows to one Turnamen,
 * `ageCategoryId` to one KU (age group) — across all Turnamen, or inside the
 * chosen one. With neither, every award is listed.
 */
export async function getBadgeGallery(params: IntelligenceParams = {}, scope: string[] | null = null) {
  const t = await getSafeT();
  const conds: SQL[] = [];
  const scoped = playerScopeFilter(scope);
  if (scoped) conds.push(scoped);
  const competitionId = paramValue(params, "turnamen");
  const kuRows = await db.selectDistinct({ id: ageCategories.id, code: ageCategories.code, sortOrder: ageCategories.sortOrder })
    .from(tournaments).innerJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(competitionId ? eq(tournaments.competitionId, competitionId) : undefined).orderBy(asc(ageCategories.sortOrder));
  const ageCategoryId = kuRows.some((k) => k.id === paramValue(params, "ku")) ? paramValue(params, "ku") : "";
  if (competitionId) conds.push(eq(tournaments.competitionId, competitionId));
  if (ageCategoryId) conds.push(eq(tournaments.ageCategoryId, ageCategoryId));
  const q = paramValue(params, "q").trim().slice(0, 200);
  // a badge matches by its stored (Indonesian) text or by the text as the viewer reads it
  const defs = await db.select().from(badges).orderBy(asc(badges.name));
  const badgeText = (d: { name: string; description: string }) =>
    [d.name, d.description, t.dyn(d.name), t.dyn(d.description)].join(" ").toLowerCase();
  const badgeName = (d: { name: string }) => t.dyn(d.name);
  if (q) {
    const ids = defs.filter((d) => badgeText(d).includes(q.toLowerCase())).map((d) => d.id);
    conds.push(or(like(players.fullName, `%${q}%`), ids.length ? inArray(badges.id, ids) : undefined)!);
  }
  const club = paramValue(params, "club");
  if (club) conds.push(eq(players.clubId, club));
  const roles = expandPosition(paramValue(params, "position"));
  if (roles.length) conds.push(inArray(players.position, roles));
  const from = paramValue(params, "from");
  const to = paramValue(params, "to");
  const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
  // Date controls follow the app's WIB timezone, with an exclusive upper boundary.
  if (validDate(from)) conds.push(gte(playerBadges.awardedAt, new Date(from + "T00:00:00+07:00")));
  if (validDate(to)) conds.push(sql`${playerBadges.awardedAt} < ${new Date(new Date(to + "T00:00:00+07:00").getTime() + 86400000)}`);

  const scoreScope: SQL[] = competitionId || ageCategoryId ? [sql`${playerStats.tournamentId} is not null`] : [isNull(playerStats.tournamentId), eq(playerStats.season, "career")];
  if (competitionId) scoreScope.push(eq(tournaments.competitionId, competitionId));
  if (ageCategoryId) scoreScope.push(eq(tournaments.ageCategoryId, ageCategoryId));
  const [awards, competitionRows, scoreRows] = await Promise.all([
    db
      .select({
        id: playerBadges.id,
        badgeId: playerBadges.badgeId,
        playerId: playerBadges.playerId,
        playerName: players.fullName,
        club: clubs.shortName,
        context: playerBadges.context,
        awardedAt: playerBadges.awardedAt,
        kuId: tournaments.id,
        competition: competitions.name,
        ageCode: ageCategories.code,
      })
      .from(playerBadges)
      .innerJoin(badges, eq(badges.id, playerBadges.badgeId))
      .innerJoin(players, eq(players.id, playerBadges.playerId))
      .leftJoin(clubs, eq(clubs.id, players.clubId))
      // an award without a KU (very old data) only shows when nothing is filtered
      .leftJoin(tournaments, eq(tournaments.id, playerBadges.tournamentId))
      .leftJoin(competitions, eq(competitions.id, tournaments.competitionId))
      .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(
        paramValue(params, "awardSort") === "name" ? asc(players.fullName) : paramValue(params, "awardSort") === "oldest" ? asc(playerBadges.awardedAt) : desc(playerBadges.awardedAt),
        asc(playerBadges.id),
      ),
    db
      .select({ id: competitions.id, name: competitions.name, season: competitions.season })
      .from(competitions)
      .orderBy(desc(competitions.createdAt)),
    db.select({ playerId: playerStats.playerId, score: sql<number>`coalesce(sum(${playerStats.score}), 0)` })
      .from(playerStats).leftJoin(tournaments, eq(tournaments.id, playerStats.tournamentId))
      .where(and(...scoreScope)).groupBy(playerStats.playerId),
  ]);
  const scores = new Map(scoreRows.map((s) => [s.playerId, Number(s.score)]));

  const badgeId = paramValue(params, "badge");
  const earned = paramValue(params, "earned");
  const sort = paramValue(params, "sort");
  const direction = paramValue(params, "order") === "desc" ? -1 : 1;
  const scopedAwards = club || roles.length || validDate(from) || validDate(to);
  const badgeRows = defs.map((d) => ({ ...d, awards: awards.filter((a) => a.badgeId === d.id).map((a) => ({ ...a, score: scores.get(a.playerId) ?? 0 })) }))
    .filter((b) => (!badgeId || b.id === badgeId) &&
      (earned === "yes" ? b.awards.length > 0 : earned === "no" ? b.awards.length === 0 : true) &&
      (!q || b.awards.length > 0 || badgeText(b).includes(q.toLowerCase())) &&
      (!scopedAwards || earned === "no" || b.awards.length > 0))
    .sort((a, b) => {
      const latest = (b: typeof a) => Math.max(0, ...b.awards.map((a) => a.awardedAt.getTime()));
      const value = sort === "count" ? a.awards.length - b.awards.length : sort === "recent" ? latest(a) - latest(b) : badgeName(a).localeCompare(badgeName(b), "id");
      return direction * value || badgeName(a).localeCompare(badgeName(b), "id") || a.id.localeCompare(b.id);
    });
  const paging = parsePagination(params);
  const pagination = pageWindow(badgeRows.length, paging.page, paging.pageSize);
  return {
    badges: badgeRows.slice(pagination.offset, pagination.offset + pagination.pageSize),
    badgeOptions: defs.map((b) => ({ value: b.id, label: badgeName(b) })),
    totalAwards: badgeRows.reduce((sum, b) => sum + b.awards.length, 0),
    competitions: competitionRows,
    kus: kuRows.map((k) => ({ id: k.id, code: k.code })),
    selectedKu: ageCategoryId,
    ...pagination,
  };
}

export async function getManualBadgeOptions(params: IntelligenceParams) {
  const conds: SQL[] = [];
  if (paramValue(params, "turnamen")) conds.push(eq(tournaments.competitionId, paramValue(params, "turnamen")));
  if (paramValue(params, "ku")) conds.push(eq(tournaments.ageCategoryId, paramValue(params, "ku")));
  const kus = await db.select({ id: tournaments.id, competition: competitions.name, age: ageCategories.code })
    .from(tournaments).innerJoin(competitions, eq(competitions.id, tournaments.competitionId)).leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(conds.length ? and(...conds) : undefined).orderBy(asc(competitions.name), asc(ageCategories.sortOrder));
  const teams = kus.length ? await db.select().from(tournamentTeams).where(inArray(tournamentTeams.tournamentId, kus.map((k) => k.id))) : [];
  return Promise.all(kus.map(async (k) => ({ id: k.id, label: `${k.competition} · ${k.age ?? "KU"}`,
    players: await getEligibleMatchPlayers(k.id, teams.filter((t) => t.tournamentId === k.id).map((t) => t.clubId)),
  })));
}

export async function getFormulaData(params: IntelligenceParams = {}, scope: string[] | null = null) {
  const list = await db.query.scoringFormulas.findMany({
    orderBy: (f, { desc: d }) => [d(f.isActive), d(f.createdAt)],
  });
  // Filter before ranking. All matching candidates are needed to rank a custom draft accurately.
  const preview = await db
    .select({
      id: players.id,
      name: players.fullName,
      club: clubs.shortName,
      position: players.position,
      ageCode: ageCategories.code,
      rating: playerStats.rating,
      score: playerStats.score,
      goals: playerStats.goals,
      assists: playerStats.assists,
      saves: playerStats.saves, // not scored, but the preview can still be sorted by it
      interceptions: playerStats.interceptions,
      yellowCards: playerStats.yellowCards,
      redCards: playerStats.redCards,
      minutesPlayed: playerStats.minutesPlayed,
      appearances: playerStats.appearances,
      shotsOnTarget: playerStats.shotsOnTarget,
      shotsOffTarget: playerStats.shotsOffTarget,
    })
    .from(playerStats)
    .innerJoin(players, eq(players.id, playerStats.playerId))
    .leftJoin(clubs, eq(clubs.id, players.clubId))
    .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
    .where(playerConditions(parsePlayerFilters(params, 3), scope))
    .orderBy(desc(playerStats.score), asc(players.fullName), asc(players.id));

  return { list, preview };
}

export async function getPositionOptions() {
  return db
    .select({ code: ageCategories.code })
    .from(ageCategories)
    .orderBy(asc(ageCategories.sortOrder));
}
