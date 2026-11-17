import { and, asc, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/lib/db";
import { ageCategories, clubs, players } from "@/lib/db/schema";
import { expandPosition } from "@/lib/positions";
import { getPlayerProfile, getRegistryFilters } from "@/lib/queries/registry";

/**
 * The public face of the player registry (/pemain). It shows what the master player pages show
 * minus everything personal: NISN, date and place of birth (so no exact age either), guardian and
 * guardian contact, verification date / notes, and the private documents.
 *
 * Nothing sensitive is read for the list, and the profile is rebuilt field by field from the full
 * profile — a column added to `players` later stays out of the public pages until it is listed here.
 * Search matches name, nickname and registration number only: matching on NISN would let anyone
 * confirm a guess.
 */

export type PublicPlayerListParams = {
  q?: string;
  club?: string;
  age?: string;
  position?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export const PUBLIC_PLAYER_PAGE_SIZE = 20;

export async function listPublicPlayers(params: PublicPlayerListParams) {
  const sc = alias(clubs, "sc");
  const page = Math.max(1, Number(params.page) || 1);
  const conds: SQL[] = [];

  const q = params.q?.trim().slice(0, 100);
  if (q) {
    conds.push(
      or(
        like(players.fullName, `%${q}%`),
        like(players.nickname, `%${q}%`),
        like(players.registrationNo, `%${q}%`),
      )!,
    );
  }
  if (params.club) conds.push(or(eq(players.clubId, params.club), eq(players.secondClubId, params.club))!);
  if (params.age) conds.push(eq(players.ageCategoryId, params.age));
  const roles = expandPosition(params.position);
  if (roles.length) conds.push(inArray(players.position, roles));
  const where = conds.length ? and(...conds) : undefined;

  const sortCol =
    params.sort === "club" ? clubs.name : params.sort === "age" ? ageCategories.sortOrder : players.fullName;
  const dir = params.dir === "desc" ? desc : asc;

  const [rows, totalRes, filters] = await Promise.all([
    db
      .select({
        id: players.id,
        fullName: players.fullName,
        nickname: players.nickname,
        registrationNo: players.registrationNo,
        photoUrl: players.photoUrl,
        foot: players.foot,
        position: players.position,
        jerseyNumber: players.jerseyNumber,
        verified: eq(players.verificationStatus, "verified"),
        clubName: clubs.name,
        clubShort: clubs.shortName,
        secondClubName: sc.name,
        secondClubShort: sc.shortName,
        ageCode: ageCategories.code,
      })
      .from(players)
      .leftJoin(clubs, eq(clubs.id, players.clubId))
      .leftJoin(sc, eq(sc.id, players.secondClubId))
      .leftJoin(ageCategories, eq(ageCategories.id, players.ageCategoryId))
      .where(where)
      .orderBy(dir(sortCol), asc(players.fullName), asc(players.id))
      .limit(PUBLIC_PLAYER_PAGE_SIZE)
      .offset((page - 1) * PUBLIC_PLAYER_PAGE_SIZE),
    db.select({ n: count() }).from(players).where(where),
    getRegistryFilters(null),
  ]);

  return {
    // `verified` comes back as 0/1 from MariaDB
    rows: rows.map((r) => ({ ...r, verified: !!r.verified })),
    total: totalRes[0].n,
    page,
    pageSize: PUBLIC_PLAYER_PAGE_SIZE,
    filters,
  };
}

/** The profile a visitor may see. `clubFilter` narrows the statistics to one club, as on the master page. */
export async function getPublicPlayerProfile(id: string, clubFilter?: string) {
  const data = await getPlayerProfile(id, clubFilter);
  if (!data) return null;
  const p = data.player;
  return {
    player: {
      id: p.id,
      fullName: p.fullName,
      nickname: p.nickname,
      registrationNo: p.registrationNo,
      photoUrl: p.photoUrl,
      position: p.position,
      jerseyNumber: p.jerseyNumber,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      foot: p.foot,
      /** Only whether the identity check passed — never the date, the notes or who did it. */
      verified: p.verificationStatus === "verified",
      club: p.club ? { id: p.club.id, name: p.club.name, shortName: p.club.shortName } : null,
      secondClub: p.secondClub ? { id: p.secondClub.id, name: p.secondClub.name, shortName: p.secondClub.shortName } : null,
      ageCode: p.ageCategory?.code ?? null,
      badges: p.badges.map((b) => ({
        id: b.id,
        context: b.context,
        badge: { name: b.badge.name, icon: b.badge.icon, description: b.badge.description },
      })),
      seasonHistory: p.seasonHistory.map((h) => ({
        id: h.id,
        season: h.season,
        ageCategoryCode: h.ageCategoryCode,
        appearances: h.appearances,
        goals: h.goals,
        avgRating: h.avgRating,
      })),
    },
    clubChips: data.clubChips,
    selectedClub: data.selectedClub,
    totals: data.totals,
    tournaments: data.tournaments.map((st) => ({
      id: st.id,
      season: st.season,
      tournamentName: st.tournamentName,
      clubName: st.clubName,
      clubShort: st.clubShort,
      appearances: st.appearances,
      goals: st.goals,
      assists: st.assists,
      rating: st.rating,
      score: st.score,
    })),
    peers: data.peers,
  };
}
