import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ageCategories,
  clubs,
  coaches,
  competitions,
  players,
  printTemplates,
  tournamentTeams,
  tournaments,
} from "@/lib/db/schema";
import { ascNullsLast } from "@/lib/db/order";
import { competitionScopeFilter } from "@/lib/competition-scope";
import { clubScopeFilter, inClubScope } from "@/lib/club-scope";
import { getEligibleMatchPlayers } from "@/lib/queries/match-roster";
import { POSITION_NAME, isPlayerPosition } from "@/lib/positions";
import { ageOn, normalizeLayout, type PrintKind, type PrintRecord } from "@/lib/print/layout";
import type { Formatters } from "@/lib/i18n/format";
import type { TFunction } from "@/lib/i18n/translate";

/* Data behind Generate → Name Tag / Sertifikat. */

export type PrintI18n = { t: TFunction; fmt: Formatters };

/** Turnamen the viewer may print for, newest first. */
export async function getPrintCompetitions(scope: string[] | null) {
  return db
    .select({ id: competitions.id, name: competitions.name, season: competitions.season })
    .from(competitions)
    .where(competitionScopeFilter(competitions.id, scope))
    .orderBy(desc(competitions.createdAt));
}

export type PrintTemplate = {
  imageUrl: string;
  width: number;
  height: number;
  layout: ReturnType<typeof normalizeLayout>;
  updatedAt: Date;
};

export async function getPrintTemplate(competitionId: string, kind: PrintKind): Promise<PrintTemplate | null> {
  const [row] = await db
    .select()
    .from(printTemplates)
    .where(and(eq(printTemplates.competitionId, competitionId), eq(printTemplates.kind, kind)));
  if (!row) return null;
  return {
    imageUrl: row.imageUrl,
    width: row.width,
    height: row.height,
    layout: normalizeLayout(kind, row.layout),
    updatedAt: row.updatedAt,
  };
}

/** The KUs of a Turnamen, youngest category first. */
export async function getPrintKus(competitionId: string) {
  return db
    .select({
      id: tournaments.id,
      code: ageCategories.code,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
    })
    .from(tournaments)
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(eq(tournaments.competitionId, competitionId))
    .orderBy(ascNullsLast(ageCategories.sortOrder));
}

/** Every SSB that takes part in at least one KU of the Turnamen (within the viewer's SSB scope). */
export async function getPrintClubs(competitionId: string, clubScope: string[] | null) {
  return db
    .selectDistinct({ id: clubs.id, name: clubs.name, short: clubs.shortName })
    .from(tournamentTeams)
    .innerJoin(tournaments, eq(tournaments.id, tournamentTeams.tournamentId))
    .innerJoin(clubs, eq(clubs.id, tournamentTeams.clubId))
    .where(and(eq(tournaments.competitionId, competitionId), clubScopeFilter(clubs.id, clubScope)))
    .orderBy(asc(clubs.name));
}

/** The day the Turnamen starts (its earliest KU), else today — the date ages are counted on. */
function referenceDate(kus: { startDate: string | null }[]) {
  const starts = kus.map((k) => k.startDate).filter((d): d is string => !!d).sort();
  return starts[0] ? new Date(`${starts[0]}T00:00:00+07:00`) : new Date();
}

const positionName = (pos: string | null, t: TFunction) => (pos && isPlayerPosition(pos) ? t.dyn(POSITION_NAME[pos]) : "");

type PlayerRow = { id: string; fullName: string; dob: string; nisn: string; photoUrl: string | null; position: string };

async function playerDetails(ids: string[]): Promise<Map<string, PlayerRow>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ id: players.id, fullName: players.fullName, dob: players.dob, nisn: players.nisn, photoUrl: players.photoUrl, position: players.position })
    .from(players)
    .where(inArray(players.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Name tags of one SSB in a Turnamen: its players in every KU it plays (the KU squad when one was
 * registered, else the SSB's players of that age category) and its coaches. Players first by
 * shirt number, then coaches.
 */
export async function getNameTagRecords(
  competition: { id: string; name: string; season: string },
  club: { id: string; name: string },
  { t, fmt }: PrintI18n,
): Promise<PrintRecord[]> {
  const kus = await db
    .select({ id: tournaments.id, code: ageCategories.code, startDate: tournaments.startDate })
    .from(tournamentTeams)
    .innerJoin(tournaments, eq(tournaments.id, tournamentTeams.tournamentId))
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId))
    .where(and(eq(tournaments.competitionId, competition.id), eq(tournamentTeams.clubId, club.id)))
    .orderBy(ascNullsLast(ageCategories.sortOrder));
  const on = referenceDate(kus);

  // A player can appear in two KUs (playing up): one tag, both KUs listed.
  const squad = new Map<string, { jersey: number | null; kus: string[] }>();
  for (const ku of kus) {
    for (const p of await getEligibleMatchPlayers(ku.id, [club.id])) {
      const seen = squad.get(p.id);
      if (seen) seen.kus.push(ku.code ?? "");
      else squad.set(p.id, { jersey: p.jersey ?? null, kus: [ku.code ?? ""] });
    }
  }
  const details = await playerDetails([...squad.keys()]);
  const playerRecords: PrintRecord[] = [...squad.entries()]
    .flatMap(([id, s]) => {
      const p = details.get(id);
      if (!p) return [];
      const ku = s.kus.filter(Boolean).join(", ");
      return [{
        id,
        kind: "player" as const,
        label: p.fullName,
        detail: [ku, positionName(p.position, t)].filter(Boolean).join(" · "),
        photoUrl: p.photoUrl,
        sort: s.jersey ?? 999,
        values: {
          name: p.fullName,
          dob: fmt.date(p.dob, { dateStyle: "long" }),
          age: t("{n} tahun", { n: ageOn(p.dob, on) }),
          club: club.name,
          nisn: p.nisn,
          role: t("Pemain::peran"),
          ku,
          number: s.jersey != null ? String(s.jersey) : "",
          position: positionName(p.position, t),
          competition: competition.name,
          season: competition.season,
        },
      }];
    })
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
    .map(({ sort: _sort, ...r }) => r);

  const coachRows = await db
    .select({ id: coaches.id, fullName: coaches.fullName, dob: coaches.dob, photoUrl: coaches.photoUrl, specialty: coaches.specialty })
    .from(coaches)
    .where(or(eq(coaches.clubId, club.id), eq(coaches.secondClubId, club.id)))
    .orderBy(ascNullsLast(coaches.specialty), asc(coaches.fullName));
  const allKus = kus.map((k) => k.code).filter(Boolean).join(", ");
  const coachRecords: PrintRecord[] = coachRows.map((c) => {
    const role = c.specialty ? t.dyn(c.specialty) : t("Pelatih::peran");
    return {
      id: c.id,
      kind: "coach",
      label: c.fullName,
      detail: role,
      photoUrl: c.photoUrl,
      values: {
        name: c.fullName,
        dob: c.dob ? fmt.date(c.dob, { dateStyle: "long" }) : "",
        age: c.dob ? t("{n} tahun", { n: ageOn(c.dob, on) }) : "",
        club: club.name,
        nisn: "",
        role,
        ku: allKus,
        competition: competition.name,
        season: competition.season,
      },
    };
  });

  return [...playerRecords, ...coachRecords];
}

/** Certificates of one KU: every player of every SSB taking part, by SSB then shirt number. */
export async function getCertificateRecords(
  competition: { id: string; name: string; season: string },
  ku: { id: string; code: string | null; endDate: string | null },
  clubScope: string[] | null,
  { t, fmt }: PrintI18n,
): Promise<PrintRecord[]> {
  const teams = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(tournamentTeams)
    .innerJoin(clubs, eq(clubs.id, tournamentTeams.clubId))
    .where(eq(tournamentTeams.tournamentId, ku.id))
    .orderBy(asc(clubs.name));
  const visible = teams.filter((c) => inClubScope(clubScope, c.id));
  if (!visible.length) return [];
  const clubName = new Map(visible.map((c) => [c.id, c.name]));
  const squad = await getEligibleMatchPlayers(ku.id, visible.map((c) => c.id));
  const details = await playerDetails(squad.map((p) => p.id));
  const issued = fmt.date(ku.endDate ? `${ku.endDate}T12:00:00+07:00` : new Date(), { dateStyle: "long" });
  const order = new Map(visible.map((c, i) => [c.id, i]));

  return squad
    .filter((p) => details.has(p.id))
    .sort((a, b) => (order.get(a.clubId) ?? 0) - (order.get(b.clubId) ?? 0) || (a.jersey ?? 999) - (b.jersey ?? 999) || a.name.localeCompare(b.name))
    .map((p) => {
      const d = details.get(p.id)!;
      const club = clubName.get(p.clubId) ?? "";
      return {
        id: p.id,
        kind: "player" as const,
        label: d.fullName,
        detail: [club, positionName(d.position, t)].filter(Boolean).join(" · "),
        photoUrl: d.photoUrl,
        values: {
          name: d.fullName,
          club,
          ku: ku.code ?? "",
          competition: competition.name,
          season: competition.season,
          position: positionName(d.position, t),
          number: p.jersey != null ? String(p.jersey) : "",
          date: issued,
        },
      };
    });
}
