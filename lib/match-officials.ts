import { and, asc, eq, gte, inArray, lte, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { z } from "zod";
import { db } from "@/lib/db";
import { clubs, matchLineups, matchOperators, matches, operatorCompetitions, referees, tournaments, users } from "@/lib/db/schema";
import { licenseStatus } from "@/lib/status";
import { MAX_MATCH_MINUTES, MIN_MATCH_MINUTES } from "@/lib/match-clock";
import { getSafeI18n, getSafeT } from "@/lib/i18n/server";

export type MatchOperator = { id: string; name: string };

/** Includes legacy assignments, e.g. a seed or imported match not yet resaved. */
export async function getAssignedOperators(matchId: string, legacyOperatorId: string | null) {
  return db.select({ id: users.id, name: users.name })
    .from(users)
    .leftJoin(matchOperators, and(eq(matchOperators.userId, users.id), eq(matchOperators.matchId, matchId)))
    .where(or(
      eq(matchOperators.matchId, matchId),
      legacyOperatorId ? eq(users.id, legacyOperatorId) : undefined,
    ))
    .orderBy(asc(users.name), asc(users.id));
}

const assignmentSchema = z.object({
  matchId: z.string().uuid(),
  refereeId: z.string().uuid().nullable(),
  operatorIds: z.array(z.string().uuid()),
});

/** Replace the assignment atomically; the match lock also protects kick-off. */
export async function saveMatchOfficials(input: z.infer<typeof assignmentSchema>) {
  const t = await getSafeT();
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) throw new Error(t("Data penugasan tidak valid"));
  const { matchId, refereeId } = parsed.data;
  const operatorIds = [...new Set(parsed.data.operatorIds)].sort();

  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!m) throw new Error(t("Pertandingan tidak ditemukan"));
    if (m.status !== "scheduled") throw new Error(t("Penugasan hanya bisa diubah sebelum pertandingan dimulai"));

    let refereeName: string | null = null;
    if (refereeId) {
      const [r] = await tx.select().from(referees).where(eq(referees.id, refereeId));
      if (!r) throw new Error(t("Wasit tidak ditemukan"));
      const st = licenseStatus(r.licenseExpiry, r.status === "revoked");
      if (st === "expired" || st === "revoked")
        throw new Error(st === "expired" ? t("Lisensi {name} sudah kedaluwarsa", { name: r.fullName }) : t("Lisensi {name} telah dicabut", { name: r.fullName }));
      refereeName = r.fullName;
    }
    const operators = operatorIds.length
      ? await tx.select({ id: users.id, name: users.name, role: users.role, active: users.active })
          .from(users).where(inArray(users.id, operatorIds))
      : [];
    if (operators.length !== operatorIds.length || operators.some((o) => !o.active))
      throw new Error(t("Salah satu operator tidak ditemukan atau tidak aktif"));
    if (operators.some((o) => o.role !== "operator" && o.role !== "admin"))
      throw new Error(t("Semua petugas pencatat harus operator kompetisi atau admin"));

    const previous = await tx.select({ id: matchOperators.userId }).from(matchOperators)
      .where(eq(matchOperators.matchId, matchId));
    const previousIds = [...new Set([...previous.map((o) => o.id), ...(m.operatorId ? [m.operatorId] : [])])].sort();

    // A newly added operator must be assigned to this match's Turnamen (earlier assignments may stay).
    const added = operators.filter((o) => o.role === "operator" && !previousIds.includes(o.id));
    if (added.length) {
      const [ku] = await tx.select({ competitionId: tournaments.competitionId }).from(tournaments).where(eq(tournaments.id, m.tournamentId));
      const allowed = ku
        ? new Set((await tx.select({ id: operatorCompetitions.userId }).from(operatorCompetitions)
            .where(and(eq(operatorCompetitions.competitionId, ku.competitionId), inArray(operatorCompetitions.userId, added.map((o) => o.id))))).map((r) => r.id))
        : new Set<string>();
      const outside = added.filter((o) => !allowed.has(o.id));
      if (outside.length)
        throw new Error(t("{names} belum ditugaskan ke turnamen ini. Tugaskan di Master Data → Operator.", { names: outside.map((o) => o.name).join(", ") }));
    }
    await tx.delete(matchOperators).where(eq(matchOperators.matchId, matchId));
    if (operatorIds.length) await tx.insert(matchOperators).values(operatorIds.map((userId) => ({ matchId, userId })));
    await tx.update(matches).set({ refereeId, operatorId: operatorIds[0] ?? null, updatedAt: new Date() })
      .where(eq(matches.id, matchId));

    return {
      match: m,
      refereeName,
      operators: operators.map(({ id, name }) => ({ id, name })),
      before: { refereeId: m.refereeId, operatorIds: previousIds },
      after: { refereeId, operatorIds },
    };
  });
}

/** Kick-off and assignment edits acquire the same lock, so neither can race the other. */
export async function startAssignedMatch(matchId: string, durationMinutes: number) {
  const t = await getSafeT();
  const duration = Math.round(Number(durationMinutes));
  if (!Number.isFinite(duration) || duration < MIN_MATCH_MINUTES || duration > MAX_MATCH_MINUTES)
    throw new Error(t("Durasi harus antara {min} dan {max} menit", { min: MIN_MATCH_MINUTES, max: MAX_MATCH_MINUTES }));
  return db.transaction(async (tx) => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!match) throw new Error(t("Pertandingan tidak ditemukan"));
    if (match.status !== "scheduled") throw new Error(t("Pertandingan sudah dimulai atau tidak dapat dimulai"));
    const operators = await tx.select({ id: matchOperators.userId }).from(matchOperators)
      .where(eq(matchOperators.matchId, matchId)).limit(1);
    if (!match.refereeId || (!match.operatorId && !operators.length))
      throw new Error(t("Tugaskan wasit dan minimal satu operator terlebih dahulu sebelum memulai pertandingan."));
    const lineup = await tx.select({ clubId: matchLineups.clubId }).from(matchLineups).where(eq(matchLineups.matchId, matchId));
    if (![match.homeClubId, match.awayClubId].every((id) => id && lineup.some((l) => l.clubId === id)))
      throw new Error(t("Pilih pemain kedua tim terlebih dahulu sebelum memulai pertandingan."));
    await tx.update(matches).set({
      status: "live", period: "first_half", clockStartedAt: new Date(),
      currentMinute: 0, durationMinutes: duration, updatedAt: new Date(),
    }).where(eq(matches.id, matchId));
    return { ...match, durationMinutes: duration };
  });
}

/** Warn for every selected operator, including secondary and legacy assignments. */
export async function officialAssignmentConflicts(
  m: { id: string; scheduledAt: Date },
  refereeId: string | null,
  operators: MatchOperator[],
) {
  if (!refereeId && !operators.length) return [];
  const { t, fmt } = await getSafeI18n();
  const operatorIds = operators.map((o) => o.id);
  const home = alias(clubs, "assignment_home");
  const away = alias(clubs, "assignment_away");
  const rows = await db.select({
    scheduledAt: matches.scheduledAt,
    refereeId: matches.refereeId,
    legacyOperatorId: matches.operatorId,
    operatorId: matchOperators.userId,
    home: home.shortName,
    away: away.shortName,
  }).from(matches)
    .leftJoin(home, eq(home.id, matches.homeClubId))
    .leftJoin(away, eq(away.id, matches.awayClubId))
    .leftJoin(matchOperators, eq(matchOperators.matchId, matches.id))
    .where(and(
      ne(matches.id, m.id),
      gte(matches.scheduledAt, new Date(m.scheduledAt.getTime() - 2 * 3_600_000)),
      lte(matches.scheduledAt, new Date(m.scheduledAt.getTime() + 2 * 3_600_000)),
      inArray(matches.status, ["scheduled", "live", "halftime"]),
      or(
        refereeId ? eq(matches.refereeId, refereeId) : undefined,
        operatorIds.length ? inArray(matches.operatorId, operatorIds) : undefined,
        operatorIds.length ? inArray(matchOperators.userId, operatorIds) : undefined,
      ),
    ));
  const warnings = new Set<string>();
  for (const row of rows) {
    const where = `${row.home ?? "?"} vs ${row.away ?? "?"} (${fmt.dateTime(row.scheduledAt)})`;
    if (refereeId && row.refereeId === refereeId) warnings.add(t("Wasit juga bertugas di {where}", { where }));
    for (const operator of operators) {
      if (operator.id === row.operatorId || operator.id === row.legacyOperatorId)
        warnings.add(t("Operator {name} juga bertugas di {where}", { name: operator.name, where }));
    }
  }
  return [...warnings];
}
