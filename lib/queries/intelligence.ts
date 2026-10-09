import { and, asc, desc, eq, like, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { expandPosition, positionLine, rolesOfLine } from "@/lib/positions";
import {
  ageCategories,
  badges,
  clubs,
  playerBadges,
  players,
  playerStats,
} from "@/lib/db/schema";

export async function searchPlayersForRadar(q?: string, position?: string, age?: string) {
  const conds = [eq(playerStats.season, "career"), sql`${playerStats.appearances} > 0`];
  if (q) conds.push(like(players.fullName, `%${q}%`));
  const roles = expandPosition(position);
  if (roles.length) conds.push(inArray(players.position, roles));
  if (age) conds.push(eq(ageCategories.code, age));

  return db
    .select({
      id: players.id,
      name: players.fullName,
      club: clubs.shortName,
      clubColor: clubs.primaryColor,
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
    .where(and(...conds))
    .orderBy(desc(playerStats.score))
    .limit(40);
}

export async function getPlayerRadarData(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: players.id,
      name: players.fullName,
      club: clubs.shortName,
      clubColor: clubs.primaryColor,
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
    .where(inArray(players.id, ids));
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

export async function getBadgeGallery() {
  const defs = await db.select().from(badges);
  const awards = await db
    .select({
      badgeId: playerBadges.badgeId,
      playerId: playerBadges.playerId,
      playerName: players.fullName,
      club: clubs.shortName,
      context: playerBadges.context,
      awardedAt: playerBadges.awardedAt,
    })
    .from(playerBadges)
    .innerJoin(players, eq(players.id, playerBadges.playerId))
    .leftJoin(clubs, eq(clubs.id, players.clubId))
    .orderBy(desc(playerBadges.awardedAt));

  return defs.map((d) => ({
    ...d,
    awards: awards.filter((a) => a.badgeId === d.id),
  }));
}

export async function getFormulaData() {
  const formulas = await db
    .select()
    .from(playerStats)
    .limit(0); // placeholder
  void formulas;
  const list = await db.query.scoringFormulas.findMany({
    orderBy: (f, { desc: d }) => [d(f.isActive), d(f.createdAt)],
  });
  // preview: top 8 by score under active formula
  const preview = await db
    .select({
      id: players.id,
      name: players.fullName,
      club: clubs.shortName,
      position: players.position,
      score: playerStats.score,
      goals: playerStats.goals,
      assists: playerStats.assists,
      saves: playerStats.saves,
      tackles: playerStats.tackles,
      interceptions: playerStats.interceptions,
      keyPasses: playerStats.keyPasses,
      duelsWon: playerStats.duelsWon,
      cleanSheets: playerStats.cleanSheets,
      yellowCards: playerStats.yellowCards,
      redCards: playerStats.redCards,
      minutesPlayed: playerStats.minutesPlayed,
      motm: playerStats.motm,
      appearances: playerStats.appearances,
    })
    .from(playerStats)
    .innerJoin(players, eq(players.id, playerStats.playerId))
    .leftJoin(clubs, eq(clubs.id, players.clubId))
    .where(and(eq(playerStats.season, "career"), sql`${playerStats.appearances} >= 3`))
    .orderBy(desc(playerStats.score))
    .limit(60);

  return { list, preview };
}

export async function getPositionOptions() {
  return db
    .select({ code: ageCategories.code })
    .from(ageCategories)
    .orderBy(asc(ageCategories.sortOrder));
}

void or;
