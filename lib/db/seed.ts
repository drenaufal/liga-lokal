import { config } from "dotenv";
config({ path: ".env.local" });

import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { hashSync } from "bcryptjs";
import * as s from "./schema";
import { createPool } from "./pool";
import { truncateAll } from "./reset";
import { insertReturning } from "./returning";
import {
  AGE_CATEGORIES,
  BADGES,
  CITIES,
  CLUBS,
  FIRST_NAMES,
  FORMATIONS,
  LAST_NAMES,
  REFEREE_LEVELS,
  VENUES,
} from "./seed-data";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { COACH_LICENSE_LEVELS, COACH_SPECIALTIES, licenseStatus } from "@/lib/status";
import { DEFAULT_WEIGHTS, computeScore, computeRating } from "@/lib/scoring";
import {
  DEFAULT_TIEBREAKERS,
  computeStandings,
  type MatchResultInput,
} from "@/lib/standings";
import { groupStage, roundRobin } from "@/lib/fixtures";
import { LEGACY_ROLE_SPREAD, positionLine } from "@/lib/positions";

const db = drizzle(createPool(process.env.DATABASE_URL!), { schema: s, mode: "planetscale" });

/* ── deterministic RNG ─────────────────────────────────────────────── */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260907);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p: number) => rnd() < p;
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function weightedPick<T>(arr: T[], weight: (t: T) => number): T {
  const total = arr.reduce((a, t) => a + Math.max(0, weight(t)), 0);
  let r = rnd() * total;
  for (const t of arr) {
    r -= Math.max(0, weight(t));
    if (r <= 0) return t;
  }
  return arr[arr.length - 1];
}

async function insertMany<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  rows: T[],
  chunk = 350,
) {
  for (let i = 0; i < rows.length; i += chunk) {
    if (rows.length === 0) return;
    await db.insert(table).values(rows.slice(i, i + chunk));
  }
}

const SEASON = "2026";
const now = new Date("2026-09-07T10:00:00+07:00");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const daysAhead = (d: number) => new Date(now.getTime() + d * 86400000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const fullName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

/* ── shared simulation state ───────────────────────────────────────── */
type StatAcc = {
  appearances: number; minutesPlayed: number; goals: number; assists: number;
  saves: number; tackles: number; interceptions: number; keyPasses: number;
  duelsWon: number; cleanSheets: number; yellowCards: number; redCards: number;
  foulsCommitted: number; motm: number;
};
const emptyAcc = (): StatAcc => ({
  appearances: 0, minutesPlayed: 0, goals: 0, assists: 0, saves: 0, tackles: 0,
  interceptions: 0, keyPasses: 0, duelsWon: 0, cleanSheets: 0, yellowCards: 0,
  redCards: 0, foulsCommitted: 0, motm: 0,
});
const acc: Record<string, Record<string, StatAcc>> = {};
function bump(pid: string, tid: string, fn: (a: StatAcc) => void) {
  acc[pid] ??= {};
  acc[pid][tid] ??= emptyAcc();
  acc[pid].career ??= emptyAcc();
  fn(acc[pid][tid]);
  fn(acc[pid].career);
}

const eventRows: (typeof s.matchEvents.$inferInsert)[] = [];
const lineupRows: (typeof s.matchLineups.$inferInsert)[] = [];

type SeedPlayer = typeof s.players.$inferSelect & { _cat: string; _potential: number };

/* ══════════════════════════════════════════════════════════════════ */

async function main() {
  console.log("→ Reset");
  await truncateAll(process.env.DATABASE_URL!);

  /* ── Users ──────────────────────────────────────────────────────── */
  console.log("→ Users");
  const pwHash = hashSync(DEMO_PASSWORD, 10);
  const users = await insertReturning(db, s.users, DEMO_ACCOUNTS.map((a) => ({
        name: a.name,
        email: a.email,
        passwordHash: pwHash,
        role: a.role,
        title: a.title,
        image: null,
        lastLoginAt: daysAgo(int(0, 4)),
      })));
  const admin = users.find((u) => u.role === "admin")!;
  const operator = users.find((u) => u.role === "operator")!;
  const scout = users.find((u) => u.role === "scout")!;

  /* ── Age categories ─────────────────────────────────────────────── */
  console.log("→ Age categories");
  const ages = await insertReturning(db, s.ageCategories, AGE_CATEGORIES.map((a, i) => ({
        code: a.code,
        label: a.label,
        minAge: a.minAge,
        maxAge: a.maxAge,
        birthYearFrom: 2026 - a.maxAge,
        birthYearTo: 2026 - a.minAge,
        rules: a.rules,
        sortOrder: i,
      })));
  const ageByCode = Object.fromEntries(ages.map((a) => [a.code, a]));

  /* ── Scoring formulas ───────────────────────────────────────────── */
  console.log("→ Scoring formulas");
  const formulas = await insertReturning(db, s.scoringFormulas, [
      {
        name: "Formula Standar LigaLokal v1",
        description:
          "Formula penilaian seimbang lintas posisi — bobot default yang direkomendasikan untuk kompetisi akar rumput.",
        weights: DEFAULT_WEIGHTS,
        isActive: true,
        version: 1,
        createdBy: admin.id,
      },
      {
        name: "Formula Ofensif (Eksperimen)",
        description:
          "Menekankan kontribusi serangan langsung — gol & assist berbobot lebih tinggi. Cocok untuk pemanduan bakat penyerang.",
        weights: {
          ...DEFAULT_WEIGHTS,
          goal: 9,
          assist: 6,
          keyPass: 1.4,
          save: 1,
          tackle: 0.8,
        },
        isActive: false,
        version: 1,
        createdBy: admin.id,
      },
    ]);
  const activeFormula = formulas[0];

  /* ── Venues ─────────────────────────────────────────────────────── */
  console.log("→ Venues");
  const venues = await insertReturning(db, s.venues, VENUES.map((v) => ({
        name: v.name,
        city: v.city,
        province: v.province,
        address: `Jl. ${pick(LAST_NAMES)} No. ${int(1, 90)}, ${v.city}`,
        capacity: v.capacity,
        fieldCount: v.fieldCount,
        surface: v.surface,
        floodlights: v.floodlights,
        latitude: -6.2 - rnd() * 0.5,
        longitude: 106.7 + rnd() * 0.6,
      })));

  /* ── Clubs ──────────────────────────────────────────────────────── */
  console.log("→ Clubs");
  const clubs = await insertReturning(db, s.clubs, CLUBS.map((c, i) => ({
        name: c.name,
        shortName: c.short,
        slug: c.name.toLowerCase().replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, ""),
        type: c.type,
        city: c.city,
        province: c.province,
        foundedYear: c.founded,
        primaryColor: c.colors[0],
        secondaryColor: c.colors[1],
        homeVenueId: venues[i % venues.length].id,
        contactName: fullName(),
        contactEmail: `sekretariat@${c.short.toLowerCase()}.or.id`,
        contactPhone: `08${int(11, 89)}${int(10000000, 99999999)}`,
        accreditation: pick([
          "Terakreditasi A",
          "Terakreditasi B",
          "Anggota Asprov",
          "Binaan Askot",
        ]),
        logoUrl: null,
      })));

  /* ── Referees ───────────────────────────────────────────────────── */
  console.log("→ Referees");
  const referees = await insertReturning(db, s.referees, Array.from({ length: 16 }).map((_, i) => {
        const expOffset = int(-120, 400);
        let status: "active" | "expiring" | "expired" | "revoked" = "active";
        if (expOffset < 0) status = "expired";
        else if (expOffset < 45) status = "expiring";
        if (i === 3) status = "revoked";
        return {
          fullName: fullName(),
          city: pick(CITIES)[0],
          licenseLevel: pick(REFEREE_LEVELS),
          licenseNumber: `WST-${SEASON}-${String(1000 + i)}`,
          licenseIssuedAt: ymd(daysAgo(int(200, 900))),
          licenseExpiry: ymd(daysAhead(expOffset)),
          status,
          phone: `08${int(11, 89)}${int(10000000, 99999999)}`,
          email: `wasit${i + 1}@pssi-askot.or.id`,
          matchesOfficiated: int(4, 180),
          specialty: pick(["Wasit", "Wasit", "Asisten Wasit", "Wasit ke-4"]),
          photoUrl: null,
        };
      }));
  /* ── Coaches ────────────────────────────────────────────────────── */
  console.log("→ Coaches");
  const crnd = mulberry32(20261001);
  const cpick = <T>(arr: readonly T[]): T => arr[Math.floor(crnd() * arr.length)];
  const cint = (min: number, max: number) => Math.floor(crnd() * (max - min + 1)) + min;
  let coachNo = 101;
  const coaches = await insertReturning(db, s.coaches, clubs.flatMap((club, ci) =>
        COACH_SPECIALTIES.slice(0, club.type === "academy" ? 3 : 2).map((specialty, si) => {
          const head = si === 0;
          const expiry = ymd(daysAhead(cint(-90, 720)));
          const levels = head ? COACH_LICENSE_LEVELS.slice(1, 4) : COACH_LICENSE_LEVELS.slice(0, 2);
          return {
            fullName: `${cpick(FIRST_NAMES)} ${cpick(LAST_NAMES)}`,
            dob: ymd(new Date(cint(1970, 1995), cint(0, 11), cint(1, 28))),
            city: club.city,
            clubId: club.id,
            specialty,
            licenseLevel: cpick(levels),
            licenseNumber: `PLT-${SEASON}-${String(coachNo++).padStart(4, "0")}`,
            licenseIssuedAt: ymd(daysAgo(cint(300, 1500))),
            licenseExpiry: expiry,
            status: licenseStatus(expiry, ci === 5 && si === 1, now),
            experienceYears: head ? cint(6, 22) : cint(1, 9),
            phone: `08${cint(11, 89)}${cint(10000000, 99999999)}`,
            email: `pelatih${coachNo}@${club.shortName.toLowerCase()}.or.id`,
            photoUrl: null,
          };
        }),
      ));

  const activeRefs = referees.filter(
    (r) => r.status === "active" || r.status === "expiring",
  );

  /* ── Badges ─────────────────────────────────────────────────────── */
  console.log("→ Badges");
  const badges = await insertReturning(db, s.badges, BADGES);
  const badgeByCode = Object.fromEntries(badges.map((b) => [b.code, b]));

  /* ── Players ────────────────────────────────────────────────────── */
  console.log("→ Players");
  const TARGET_CATS = ["KU-12", "KU-14", "KU-16"];
  const EXTRA_CATS = ["KU-8", "KU-10"];
  let regCounter = 1;

  const makePlayer = (
    clubId: string | null,
    catCode: string,
    idx: number,
  ): typeof s.players.$inferInsert & { _cat: string; _potential: number } => {
    const cat = ageByCode[catCode];
    const birthYear = int(cat.birthYearFrom!, cat.birthYearTo!);
    const dob = new Date(birthYear, int(0, 11), int(1, 28));
    let line: "GK" | "DF" | "MF" | "FW";
    if (idx < 2) line = "GK";
    else if (idx < 7) line = "DF";
    else if (idx < 12) line = "MF";
    else line = "FW";
    if (idx >= 12 && chance(0.3)) line = "MF";
    // spread each line over its specific roles (CB/RB/LB/WB, DMF/CMF/AMF/WF, ST/CF/LW/RW)
    const roles = LEGACY_ROLE_SPREAD[line];
    const lineStart = { GK: 0, DF: 2, MF: 7, FW: 12 }[line];
    const position = roles[(idx - lineStart) % roles.length];
    const name = fullName();
    const vr = rnd();
    const verificationStatus =
      vr < 0.72 ? "verified" : vr < 0.86 ? "pending" : vr < 0.94 ? "flagged" : "rejected";
    const yearsOver8 = 2026 - birthYear - 8;
    return {
      fullName: name,
      nickname: chance(0.28) ? name.split(" ")[0] : null,
      nisn: `0${String(birthYear).slice(2)}${String(regCounter).padStart(7, "0")}`,
      registrationNo: `FG-${SEASON}-${String(regCounter++).padStart(5, "0")}`,
      dob: ymd(dob),
      birthPlace: pick(CITIES)[0],
      nationality: "Indonesia",
      gender: "L",
      heightCm: 120 + yearsOver8 * 6 + int(-6, 8),
      weightKg: 24 + yearsOver8 * 4 + int(-3, 5),
      foot: chance(0.78) ? "right" : chance(0.7) ? "left" : "both",
      position,
      jerseyNumber: idx + 1,
      clubId,
      ageCategoryId: cat.id,
      photoUrl: null,
      verificationStatus,
      verificationNotes:
        verificationStatus === "flagged"
          ? "Selisih data tanggal lahir antara akta dan kartu keluarga — menunggu klarifikasi klub."
          : verificationStatus === "rejected"
            ? "Berkas akta kelahiran tidak terbaca. Perlu unggah ulang dokumen."
            : verificationStatus === "pending"
              ? "Menunggu tinjauan operator kompetisi."
              : null,
      verifiedBy: verificationStatus === "verified" ? operator.id : null,
      verifiedAt: verificationStatus === "verified" ? daysAgo(int(5, 120)) : null,
      guardianName: fullName(),
      guardianPhone: `08${int(11, 89)}${int(10000000, 99999999)}`,
      joinedAt: ymd(daysAgo(int(30, 1400))),
      _cat: catCode,
      _potential: 0.32 + rnd() * 0.62,
    };
  };

  const playerInserts: (typeof s.players.$inferInsert & { _cat: string; _potential: number })[] = [];
  for (const club of clubs) {
    for (const cat of TARGET_CATS) {
      const size = cat === "KU-12" ? 13 : cat === "KU-14" ? 16 : 18;
      for (let i = 0; i < size; i++) playerInserts.push(makePlayer(club.id, cat, i));
    }
  }
  for (let i = 0; i < 46; i++) {
    playerInserts.push(
      makePlayer(chance(0.7) ? pick(clubs).id : null, pick(EXTRA_CATS), i),
    );
  }

  const insertedPlayers: (typeof s.players.$inferSelect)[] = [];
  for (let i = 0; i < playerInserts.length; i += 350) {
    const chunk = playerInserts
      .slice(i, i + 350)
      .map(({ _cat, _potential, ...r }) => r);
    const back = await insertReturning(db, s.players, chunk);
    insertedPlayers.push(...back);
  }
  const P: SeedPlayer[] = insertedPlayers.map((p, i) => ({
    ...p,
    _cat: playerInserts[i]._cat,
    _potential: playerInserts[i]._potential,
  }));
  // A handful of players are registered with a second club (index-based, so the
  // random sequence — and therefore all other seed data — stays unchanged).
  const dual = P.filter((p, i) => p.clubId && i % 83 === 5);
  for (const p of dual) {
    const at = clubs.findIndex((c) => c.id === p.clubId);
    p.secondClubId = clubs[(at + 1) % clubs.length].id;
    await db.update(s.players).set({ secondClubId: p.secondClubId }).where(eq(s.players.id, p.id));
  }
  const squadOf = (clubId: string, cat: string) =>
    P.filter((p) => p.clubId === clubId && p._cat === cat);
  console.log(`   ${P.length} pemain (${dual.length} dengan klub kedua)`);

  /* ── Match simulation helper ───────────────────────────────────── */
  const matchRows: (typeof s.matches.$inferInsert)[] = [];

  function startingXI(squad: SeedPlayer[]) {
    const gk = squad.filter((p) => p.position === "GK")[0] ?? squad[0];
    const outfield = shuffle(squad.filter((p) => p.id !== gk.id))
      .sort((a, b) => b._potential - a._potential)
      .slice(0, 24)
      .sort(() => rnd() - 0.5)
      .slice(0, 10);
    return [gk, ...outfield];
  }

  /** Simulate one match. Returns final scoreline. Records events + stats. */
  function simulateMatch(opts: {
    matchId: string;
    tournamentId: string;
    catCode: string;
    homeClubId: string;
    awayClubId: string;
    kickoff: Date;
    live?: boolean;
    liveMinute?: number;
    withLineups?: boolean;
    homeFormation?: string;
    awayFormation?: string;
    forcedScore?: { home: number; away: number };
  }): { home: number; away: number } {
    const { matchId, tournamentId, catCode, homeClubId, awayClubId } = opts;
    const homeSquad = squadOf(homeClubId, catCode);
    const awaySquad = squadOf(awayClubId, catCode);
    if (homeSquad.length < 8 || awaySquad.length < 8)
      return opts.forcedScore ?? { home: 0, away: 0 };

    const homeXI = startingXI(homeSquad);
    const awayXI = startingXI(awaySquad);
    const hStr = homeXI.reduce((a, p) => a + p._potential, 0) / homeXI.length + 0.06;
    const aStr = awayXI.reduce((a, p) => a + p._potential, 0) / awayXI.length;

    const full = ageByCode[catCode].rules.matchDuration;
    const dur = opts.live ? Math.min(full, opts.liveMinute ?? 60) : full;
    const prog = dur / full;

    let hg = Math.min(6, Math.max(0, Math.round((hStr * 3.6 - 0.3) * (0.45 + rnd()) * prog)));
    let ag = Math.min(6, Math.max(0, Math.round((aStr * 3.4 - 0.4) * (0.45 + rnd()) * prog)));
    if (!opts.live && hg === 0 && ag === 0 && chance(0.5)) hg = 1;
    if (opts.forcedScore) {
      hg = opts.forcedScore.home;
      ag = opts.forcedScore.away;
    }

    const half = full / 2;
    const emitGoals = (xi: SeedPlayer[], clubId: string, count: number) => {
      const scorers = xi.filter((p) => p.position !== "GK");
      for (let g = 0; g < count; g++) {
        const minute = Math.max(1, Math.min(dur, int(2, dur)));
        const period = minute > half ? "second_half" : "first_half";
        const scorer = weightedPick(
          scorers,
          (p) =>
            (positionLine(p.position) === "FW" ? 5 : positionLine(p.position) === "MF" ? 3 : 1) *
            (0.4 + p._potential),
        );
        const assister = chance(0.66)
          ? weightedPick(
              scorers.filter((p) => p.id !== scorer.id),
              (p) => (positionLine(p.position) === "MF" ? 3 : positionLine(p.position) === "FW" ? 2 : 1),
            )
          : null;
        const isPen = chance(0.11);
        eventRows.push({
          matchId,
          type: isPen ? "penalty_goal" : "goal",
          minute,
          period,
          clubId,
          playerId: scorer.id,
          relatedPlayerId: assister?.id ?? null,
          x: 50 + int(-9, 9),
          y: 12 + int(-4, 7),
          detail: isPen ? { penalty: true } : undefined,
          createdBy: operator.id,
          createdAt: opts.kickoff,
        });
        bump(scorer.id, tournamentId, (a) => a.goals++);
        if (assister) {
          eventRows.push({
            matchId,
            type: "assist",
            minute,
            period,
            clubId,
            playerId: assister.id,
            relatedPlayerId: scorer.id,
            createdBy: operator.id,
            createdAt: opts.kickoff,
          });
          bump(assister.id, tournamentId, (a) => {
            a.assists++;
            a.keyPasses++;
          });
        }
      }
    };
    emitGoals(homeXI, homeClubId, hg);
    emitGoals(awayXI, awayClubId, ag);

    const emitCards = (xi: SeedPlayer[], clubId: string) => {
      for (let y = 0; y < int(0, 3); y++) {
        const pl = weightedPick(xi, (p) =>
          positionLine(p.position) === "DF" ? 3 : positionLine(p.position) === "MF" ? 2 : 1,
        );
        const minute = int(8, dur);
        eventRows.push({
          matchId,
          type: "yellow_card",
          minute,
          period: minute > half ? "second_half" : "first_half",
          clubId,
          playerId: pl.id,
          detail: {
            reason: pick([
              "Pelanggaran taktis",
              "Protes keputusan wasit",
              "Tekel terlambat",
              "Menunda restart permainan",
            ]),
          },
          createdBy: operator.id,
          createdAt: opts.kickoff,
        });
        bump(pl.id, tournamentId, (a) => a.yellowCards++);
      }
      if (chance(0.05)) {
        const pl = pick(xi);
        eventRows.push({
          matchId,
          type: "red_card",
          minute: int(35, dur),
          period: "second_half",
          clubId,
          playerId: pl.id,
          detail: { reason: pick(["Pelanggaran serius", "Akumulasi kartu kuning"]) },
          createdBy: operator.id,
          createdAt: opts.kickoff,
        });
        bump(pl.id, tournamentId, (a) => a.redCards++);
      }
    };
    emitCards(homeXI, homeClubId);
    emitCards(awayXI, awayClubId);

    const creditXI = (xi: SeedPlayer[], conceded: number, oppShots: number) => {
      xi.forEach((p, idx) => {
        const minutes = idx < 9 ? dur : int(Math.floor(dur * 0.35), dur);
        bump(p.id, tournamentId, (a) => {
          a.appearances++;
          a.minutesPlayed += minutes;
          if (p.position === "GK") {
            a.saves += Math.max(0, oppShots - conceded);
            if (conceded === 0 && !opts.live) a.cleanSheets++;
          } else if (positionLine(p.position) === "DF") {
            a.tackles += int(1, 5);
            a.interceptions += int(0, 4);
            a.duelsWon += int(1, 6);
            if (conceded === 0 && idx < 5 && !opts.live) a.cleanSheets++;
          } else if (positionLine(p.position) === "MF") {
            a.tackles += int(0, 3);
            a.keyPasses += int(0, 3);
            a.duelsWon += int(1, 5);
            a.interceptions += int(0, 2);
          } else {
            a.keyPasses += int(0, 2);
            a.duelsWon += int(0, 4);
          }
          a.foulsCommitted += int(0, 3);
        });
      });
    };
    const homeShots = hg + int(2, 8);
    const awayShots = ag + int(2, 8);
    creditXI(homeXI, ag, awayShots);
    creditXI(awayXI, hg, homeShots);

    if (!opts.live) {
      const winnerXI = hg >= ag ? homeXI : awayXI;
      const motm = weightedPick(
        winnerXI,
        (p) =>
          (positionLine(p.position) === "FW" ? 3 : positionLine(p.position) === "MF" ? 2.5 : 1.5) * p._potential,
      );
      bump(motm.id, tournamentId, (a) => a.motm++);
      eventRows.push({
        matchId,
        type: "var_check",
        minute: full,
        period: "full_time",
        clubId: motm.clubId,
        playerId: motm.id,
        detail: { award: "Pemain Terbaik Pertandingan" },
        createdBy: operator.id,
        createdAt: opts.kickoff,
      });
    }

    if (opts.withLineups) {
      const build = (xi: SeedPlayer[], clubId: string, formation: string) => {
        const shape = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
        xi.forEach((p, idx) => {
          const slot = shape[idx] ?? { slot: "SUB", x: 50, y: 50 };
          lineupRows.push({
            matchId,
            clubId,
            playerId: p.id,
            role: "starter",
            slot: slot.slot,
            x: slot.x,
            y: slot.y,
            shirtNumber: p.jerseyNumber ?? idx + 1,
            isCaptain: idx === 4,
          });
        });
        squadOf(clubId, catCode)
          .filter((pp) => !xi.find((x) => x.id === pp.id))
          .slice(0, 7)
          .forEach((p) =>
            lineupRows.push({
              matchId,
              clubId,
              playerId: p.id,
              role: "substitute",
              shirtNumber: p.jerseyNumber ?? null,
            }),
          );
      };
      build(homeXI, homeClubId, opts.homeFormation ?? "4-3-3");
      build(awayXI, awayClubId, opts.awayFormation ?? "4-3-3");
    }

    return { home: hg, away: ag };
  }

  /* ── Tournaments ────────────────────────────────────────────────── */
  console.log("→ Turnamen");
  const TSPECS = [
    {
      name: "Liga Pelajar U-14 Jabodetabek 2026",
      cat: "KU-14",
      format: "league" as const,
      status: "ongoing" as const,
      teamCount: 8,
      completedRatio: 0.82,
      live: 1,
      host: "Asprov PSSI DKI Jakarta",
      city: "Jakarta Selatan",
      start: daysAgo(70),
      end: daysAhead(35),
    },
    {
      name: "Piala Garuda Muda U-12 2026",
      cat: "KU-12",
      format: "cup" as const,
      status: "ongoing" as const,
      teamCount: 8,
      groups: 2,
      completedRatio: 0.75,
      live: 1,
      host: "Yayasan Garuda Muda",
      city: "Depok",
      start: daysAgo(38),
      end: daysAhead(10),
    },
    {
      name: "Turnamen Kemerdekaan U-16 2026",
      cat: "KU-16",
      format: "knockout" as const,
      status: "completed" as const,
      teamCount: 8,
      completedRatio: 1,
      live: 0,
      host: "KONI Kota Bogor",
      city: "Bogor",
      start: daysAgo(46),
      end: daysAgo(31),
    },
    {
      name: "Liga Akademi U-16 Seri 2 2026",
      cat: "KU-16",
      format: "league" as const,
      status: "registration" as const,
      teamCount: 8,
      completedRatio: 0,
      live: 0,
      host: "Konsorsium Akademi Jabodetabek",
      city: "Tangerang",
      start: daysAhead(20),
      end: daysAhead(120),
    },
  ];

  const tournaments = await insertReturning(db, s.tournaments, TSPECS.map((t) => ({
        name: t.name,
        slug: t.name.toLowerCase().replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, ""),
        season: SEASON,
        format: t.format,
        status: t.status,
        ageCategoryId: ageByCode[t.cat].id,
        scoringFormulaId: activeFormula.id,
        description: `Kompetisi ${t.cat} yang diselenggarakan oleh ${t.host}. Dikelola penuh melalui LigaLokal — registrasi, verifikasi, penjadwalan, hingga operasional pertandingan real-time.`,
        host: t.host,
        city: t.city,
        startDate: ymd(t.start),
        endDate: ymd(t.end),
        groupCount: t.groups ?? 0,
        teamsPerGroup: t.groups ? t.teamCount / t.groups : 0,
        advancePerGroup: 2,
        pointsWin: 3,
        pointsDraw: 1,
        pointsLoss: 0,
        tiebreakers: DEFAULT_TIEBREAKERS,
        logoUrl: null,
        createdBy: operator.id,
        createdAt: t.start,
      })));

  const teamRows: (typeof s.tournamentTeams.$inferInsert)[] = [];
  const squadRows: (typeof s.tournamentSquad.$inferInsert)[] = [];
  const standingRows: (typeof s.standings.$inferInsert)[] = [];
  const badgeRows: (typeof s.playerBadges.$inferInsert)[] = [];

  // Helpers to schedule kickoffs
  const koTime = (base: Date, offsetDays: number) => {
    const d = new Date(base.getTime() + offsetDays * 86400000);
    d.setHours(pick([8, 10, 13, 15, 16]));
    d.setMinutes(pick([0, 30]));
    return d;
  };

  for (let ti = 0; ti < tournaments.length; ti++) {
    const tour = tournaments[ti];
    const spec = TSPECS[ti];
    const teamClubs = shuffle(clubs).slice(0, spec.teamCount);
    const groupsByClub: Record<string, string> = {};

    teamClubs.forEach((c, i) => {
      const g = spec.groups ? "AB"[i % spec.groups] : "-";
      groupsByClub[c.id] = g;
      teamRows.push({
        tournamentId: tour.id,
        clubId: c.id,
        groupLabel: spec.groups ? g : null,
        seed: i + 1,
        registrationStatus:
          spec.status === "registration"
            ? chance(0.65)
              ? "registered"
              : "invited"
            : "verified",
        squadLockedAt: spec.status === "registration" ? null : spec.start,
      });
    });

    // (matches materialised after teams inserted; store plan)
    (tour as Record<string, unknown>)._plan = { spec, teamClubs, groupsByClub };
  }

  const teams = await insertReturning(db, s.tournamentTeams, teamRows);
  const teamId = (tournamentId: string, clubId: string) =>
    teams.find((t) => t.tournamentId === tournamentId && t.clubId === clubId)!.id;

  // squads
  for (const tour of tournaments) {
    const { spec, teamClubs } = (tour as Record<string, unknown>)._plan as {
      spec: (typeof TSPECS)[number];
      teamClubs: typeof clubs;
    };
    for (const c of teamClubs) {
      for (const p of squadOf(c.id, spec.cat)) {
        squadRows.push({
          tournamentTeamId: teamId(tour.id, c.id),
          playerId: p.id,
          jerseyNumber: p.jerseyNumber ?? null,
        });
      }
    }
  }
  await insertMany(s.tournamentSquad, squadRows);

  /* Build matches per tournament */
  type PendingMatch = {
    row: typeof s.matches.$inferInsert;
    sim?: {
      catCode: string;
      live?: boolean;
      liveMinute?: number;
      withLineups?: boolean;
      forcedScore?: { home: number; away: number };
    };
  };
  const pending: PendingMatch[] = [];

  for (const tour of tournaments) {
    const { spec, teamClubs, groupsByClub } = (tour as Record<string, unknown>)
      ._plan as {
      spec: (typeof TSPECS)[number];
      teamClubs: typeof clubs;
      groupsByClub: Record<string, string>;
    };
    const ids = teamClubs.map((c) => c.id);
    const venueOf = (clubId: string) =>
      teamClubs.find((c) => c.id === clubId)?.homeVenueId ?? pick(venues).id;

    if (spec.format === "league" || spec.format === "cup") {
      const fixtures =
        spec.format === "league"
          ? roundRobin(ids, { stage: "league" })
          : groupStage(ids, spec.groups ?? 2, false);
      const total = fixtures.length;
      const completeCount = Math.round(total * spec.completedRatio);
      let liveLeft = spec.live;

      fixtures.forEach((fx, idx) => {
        const span = (spec.end.getTime() - spec.start.getTime()) / 86400000;
        const kickoff = koTime(spec.start, Math.floor((idx / total) * span));
        let status: "completed" | "live" | "scheduled" = "scheduled";
        if (idx < completeCount) status = "completed";
        else if (liveLeft > 0 && idx < completeCount + spec.live) {
          status = "live";
          liveLeft--;
        }
        const liveMinute = int(52, 74);
        pending.push({
          row: {
            tournamentId: tour.id,
            stage: spec.format === "cup" ? "group" : "league",
            round: fx.round,
            groupLabel: fx.groupLabel ?? null,
            homeClubId: fx.home,
            awayClubId: fx.away,
            venueId: venueOf(fx.home!),
            refereeId: pick(activeRefs).id,
            scheduledAt: status === "scheduled" ? koTime(now, int(2, 30)) : kickoff,
            status,
            period:
              status === "completed"
                ? "full_time"
                : status === "live"
                  ? "second_half"
                  : "not_started",
            currentMinute:
              status === "completed" ? 70 : status === "live" ? liveMinute - 2 : 0,
            clockStartedAt:
              status === "live" ? new Date(Date.now() - 2 * 60000) : null,
            homeFormation: pick(["4-3-3", "4-4-2", "4-2-3-1"]),
            awayFormation: pick(["4-3-3", "3-4-3", "4-4-2"]),
            resultStatus: status === "completed" ? "confirmed" : "unconfirmed",
            confirmedBy: status === "completed" ? operator.id : null,
            confirmedAt: status === "completed" ? kickoff : null,
            attendance: status !== "scheduled" ? int(60, 900) : null,
            weather: pick(["Cerah", "Cerah berawan", "Berawan", "Gerimis ringan"]),
            createdAt: spec.start,
          },
          sim:
            status !== "scheduled"
              ? {
                  catCode: spec.cat,
                  live: status === "live",
                  liveMinute,
                  withLineups: status === "live",
                }
              : undefined,
        });
      });

      // cup: seed a knockout bracket from provisional group standings (drawn, not played)
      if (spec.format === "cup") {
        const provisional = computeStandings(
          ids,
          pending
            .filter(
              (p) =>
                p.row.tournamentId === tour.id &&
                p.sim &&
                !p.sim.live &&
                p.row.homeClubId &&
                p.row.awayClubId,
            )
            .map((p) => ({
              homeClubId: p.row.homeClubId!,
              awayClubId: p.row.awayClubId!,
              homeScore: 0,
              awayScore: 0,
              groupLabel: p.row.groupLabel,
            })) as MatchResultInput[],
          { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, tiebreakers: DEFAULT_TIEBREAKERS },
          groupsByClub,
        );
        const winnerA = provisional.find((r) => r.groupLabel === "A" && r.rank === 1);
        const runnerA = provisional.find((r) => r.groupLabel === "A" && r.rank === 2);
        const winnerB = provisional.find((r) => r.groupLabel === "B" && r.rank === 1);
        const runnerB = provisional.find((r) => r.groupLabel === "B" && r.rank === 2);
        const semis: [string | null, string | null, string][] = [
          [winnerA?.clubId ?? null, runnerB?.clubId ?? null, "SF1"],
          [winnerB?.clubId ?? null, runnerA?.clubId ?? null, "SF2"],
        ];
        semis.forEach(([h, a, slot]) => {
          pending.push({
            row: {
              tournamentId: tour.id,
              stage: "semi",
              round: 99,
              bracketSlot: slot,
              homeClubId: h,
              awayClubId: a,
              homePlaceholder: h ? null : "Juara Grup",
              awayPlaceholder: a ? null : "Runner-up Grup",
              venueId: pick(venues).id,
              refereeId: pick(activeRefs).id,
              scheduledAt: koTime(spec.end, -6),
              status: "scheduled",
              period: "not_started",
              homeFormation: "4-3-3",
              awayFormation: "4-3-3",
              createdAt: spec.start,
            },
          });
        });
        pending.push({
          row: {
            tournamentId: tour.id,
            stage: "final",
            round: 100,
            bracketSlot: "F",
            homeClubId: null,
            awayClubId: null,
            homePlaceholder: "Pemenang SF1",
            awayPlaceholder: "Pemenang SF2",
            venueId: venues[1].id,
            refereeId: pick(activeRefs).id,
            scheduledAt: koTime(spec.end, -2),
            status: "scheduled",
            period: "not_started",
            homeFormation: "4-3-3",
            awayFormation: "4-3-3",
            createdAt: spec.start,
          },
        });
      }
    }

    if (spec.format === "knockout") {
      // fully-resolved single elimination — decide every scoreline on paper first
      const strengthOf = (clubId: string) => {
        const sq = squadOf(clubId, spec.cat);
        return sq.reduce((a, p) => a + p._potential, 0) / Math.max(1, sq.length);
      };
      const decide = (h: string, a: string) => {
        let hs = Math.max(0, Math.round((strengthOf(h) + 0.05) * 3.4 * (0.4 + rnd())));
        let as = Math.max(0, Math.round(strengthOf(a) * 3.4 * (0.4 + rnd())));
        hs = Math.min(5, hs);
        as = Math.min(5, as);
        if (hs === as) {
          // extra-time / golden goal decides — stronger side edges it
          if (strengthOf(h) + rnd() * 0.15 >= strengthOf(a) + rnd() * 0.15) hs++;
          else as++;
        }
        return { hs, as, winner: hs > as ? h : a, loser: hs > as ? a : h };
      };

      let round = shuffle(ids);
      let roundNum = 1;
      const losersBySemi: string[] = [];
      const stageFor = (n: number) =>
        n === 8 ? "quarter" : n === 4 ? "semi" : "final";
      while (round.length > 1) {
        const stage = stageFor(round.length) as
          | "quarter"
          | "semi"
          | "final";
        const prefix = stage === "final" ? "F" : stage === "semi" ? "SF" : "QF";
        const next: string[] = [];
        for (let i = 0; i < round.length; i += 2) {
          const h = round[i];
          const a = round[i + 1];
          const d = decide(h, a);
          if (stage === "semi") losersBySemi.push(d.loser);
          const kickoff = koTime(spec.start, (roundNum - 1) * 4 + i / 2);
          pending.push({
            row: {
              tournamentId: tour.id,
              stage,
              round: roundNum,
              bracketSlot: `${prefix}${i / 2 + 1}`,
              homeClubId: h,
              awayClubId: a,
              venueId: pick(venues).id,
              refereeId: pick(activeRefs).id,
              scheduledAt: kickoff,
              status: "completed",
              period: "full_time",
              currentMinute: ageByCode[spec.cat].rules.matchDuration,
              homeFormation: pick(["4-3-3", "4-4-2"]),
              awayFormation: pick(["4-3-3", "3-4-3"]),
              resultStatus: "confirmed",
              confirmedBy: operator.id,
              confirmedAt: kickoff,
              attendance: int(200, 1400),
              weather: pick(["Cerah", "Cerah berawan", "Berawan"]),
              createdAt: spec.start,
            },
            sim: {
              catCode: spec.cat,
              withLineups: stage !== "quarter",
              forcedScore: { home: d.hs, away: d.as },
            },
          });
          next.push(d.winner);
        }
        round = next;
        roundNum++;
      }
      // third-place playoff between the two semifinal losers
      if (losersBySemi.length === 2) {
        const d = decide(losersBySemi[0], losersBySemi[1]);
        pending.push({
          row: {
            tournamentId: tour.id,
            stage: "third_place",
            round: 98,
            bracketSlot: "3P",
            homeClubId: losersBySemi[0],
            awayClubId: losersBySemi[1],
            venueId: pick(venues).id,
            refereeId: pick(activeRefs).id,
            scheduledAt: koTime(spec.start, 12),
            status: "completed",
            period: "full_time",
            currentMinute: ageByCode[spec.cat].rules.matchDuration,
            resultStatus: "confirmed",
            confirmedBy: operator.id,
            confirmedAt: koTime(spec.start, 12),
            weather: "Cerah",
            createdAt: spec.start,
          },
          sim: {
            catCode: spec.cat,
            forcedScore: { home: d.hs, away: d.as },
          },
        });
      }
    }
  }

  // Insert matches, then simulate
  const insertedMatches: (typeof s.matches.$inferSelect)[] = [];
  for (let i = 0; i < pending.length; i += 300) {
    const back = await insertReturning(db, s.matches, pending.slice(i, i + 300).map((p) => p.row));
    insertedMatches.push(...back);
  }
  // matches that have started were run by the operator (kick-off needs one)
  await db
    .update(s.matches)
    .set({ operatorId: operator.id })
    .where(inArray(s.matches.status, ["live", "halftime", "completed"]));

  console.log(`→ Simulasi ${insertedMatches.length} pertandingan`);
  const scoreUpdates: {
    id: string;
    home: number;
    away: number;
    htH: number;
    htA: number;
  }[] = [];
  for (let i = 0; i < insertedMatches.length; i++) {
    const m = insertedMatches[i];
    const plan = pending[i];
    if (!plan.sim || !m.homeClubId || !m.awayClubId) continue;
    const res = simulateMatch({
      matchId: m.id,
      tournamentId: m.tournamentId,
      catCode: plan.sim.catCode,
      homeClubId: m.homeClubId,
      awayClubId: m.awayClubId,
      kickoff: m.scheduledAt,
      live: plan.sim.live,
      liveMinute: plan.sim.liveMinute,
      withLineups: plan.sim.withLineups,
      forcedScore: plan.sim.forcedScore,
      homeFormation: m.homeFormation ?? "4-3-3",
      awayFormation: m.awayFormation ?? "4-3-3",
    });
    scoreUpdates.push({
      id: m.id,
      home: res.home,
      away: res.away,
      htH: Math.floor(res.home / 2),
      htA: Math.floor(res.away / 2),
    });
  }
  for (const su of scoreUpdates) {
    await db
      .update(s.matches)
      .set({
        homeScore: su.home,
        awayScore: su.away,
        homeScoreHt: su.htH,
        awayScoreHt: su.htA,
      })
      .where(eq(s.matches.id, su.id));
  }
  await insertMany(s.matchEvents, eventRows);
  await insertMany(s.matchLineups, lineupRows);
  console.log(`   ${eventRows.length} kejadian · ${lineupRows.length} slot line-up`);

  /* ── Standings ─────────────────────────────────────────────────── */
  console.log("→ Klasemen");
  for (const tour of tournaments) {
    const { spec, teamClubs, groupsByClub } = (tour as Record<string, unknown>)
      ._plan as {
      spec: (typeof TSPECS)[number];
      teamClubs: typeof clubs;
      groupsByClub: Record<string, string>;
    };
    if (spec.format === "knockout") continue;
    const ids = teamClubs.map((c) => c.id);
    const results: MatchResultInput[] = insertedMatches
      .filter(
        (m) =>
          m.tournamentId === tour.id &&
          m.status === "completed" &&
          m.homeClubId &&
          m.awayClubId,
      )
      .map((m) => {
        const su = scoreUpdates.find((x) => x.id === m.id)!;
        const evs = eventRows.filter((e) => e.matchId === m.id);
        return {
          homeClubId: m.homeClubId!,
          awayClubId: m.awayClubId!,
          homeScore: su.home,
          awayScore: su.away,
          groupLabel: m.groupLabel,
          homeYellow: evs.filter(
            (e) => e.type === "yellow_card" && e.clubId === m.homeClubId,
          ).length,
          homeRed: evs.filter(
            (e) => e.type === "red_card" && e.clubId === m.homeClubId,
          ).length,
          awayYellow: evs.filter(
            (e) => e.type === "yellow_card" && e.clubId === m.awayClubId,
          ).length,
          awayRed: evs.filter(
            (e) => e.type === "red_card" && e.clubId === m.awayClubId,
          ).length,
        };
      });
    const rows = computeStandings(
      ids,
      results,
      { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, tiebreakers: DEFAULT_TIEBREAKERS },
      groupsByClub,
    );
    for (const r of rows) {
      standingRows.push({
        tournamentId: tour.id,
        clubId: r.clubId,
        groupLabel: r.groupLabel,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        goalsFor: r.goalsFor,
        goalsAgainst: r.goalsAgainst,
        points: r.points,
        fairPlayPoints: r.fairPlayPoints,
        form: r.form,
        rank: r.rank,
      });
    }
  }
  if (standingRows.length) await insertMany(s.standings, standingRows);

  /* ── Player stats ──────────────────────────────────────────────── */
  console.log("→ Statistik pemain");
  const statRows: (typeof s.playerStats.$inferInsert)[] = [];
  for (const p of P) {
    const scopes = acc[p.id];
    if (!scopes) {
      statRows.push({
        playerId: p.id,
        tournamentId: null,
        season: "career",
        appearances: 0,
      });
      continue;
    }
    for (const [scope, a] of Object.entries(scopes)) {
      const scorable = {
        goals: a.goals,
        assists: a.assists,
        saves: a.saves,
        tackles: a.tackles,
        interceptions: a.interceptions,
        keyPasses: a.keyPasses,
        duelsWon: a.duelsWon,
        cleanSheets: a.cleanSheets,
        yellowCards: a.yellowCards,
        redCards: a.redCards,
        minutesPlayed: a.minutesPlayed,
        motm: a.motm,
      };
      statRows.push({
        playerId: p.id,
        tournamentId: scope === "career" ? null : scope,
        clubId: scope === "career" ? null : p.clubId,
        season: scope === "career" ? "career" : SEASON,
        appearances: a.appearances,
        minutesPlayed: a.minutesPlayed,
        goals: a.goals,
        assists: a.assists,
        saves: a.saves,
        tackles: a.tackles,
        interceptions: a.interceptions,
        keyPasses: a.keyPasses,
        duelsWon: a.duelsWon,
        cleanSheets: a.cleanSheets,
        yellowCards: a.yellowCards,
        redCards: a.redCards,
        foulsCommitted: a.foulsCommitted,
        motm: a.motm,
        rating: computeRating(scorable, a.appearances || 1, activeFormula.weights),
        score: computeScore(scorable, activeFormula.weights),
      });
    }
  }
  await insertMany(s.playerStats, statRows);
  console.log(`   ${statRows.length} baris statistik`);

  /* ── Season history ────────────────────────────────────────────── */
  const historyRows: (typeof s.playerSeasonHistory.$inferInsert)[] = [];
  for (const p of P) {
    const career = acc[p.id]?.career;
    if (!career || career.appearances === 0) continue;
    for (const yr of ["2024", "2025", "2026"]) {
      const f = yr === "2026" ? 1 : yr === "2025" ? 0.7 : 0.4;
      historyRows.push({
        playerId: p.id,
        season: yr,
        clubId: p.clubId,
        ageCategoryCode: p._cat,
        appearances:
          Math.round(career.appearances * f) + (yr !== "2026" ? int(2, 8) : 0),
        goals: Math.round(career.goals * f),
        assists: Math.round(career.assists * f),
        avgRating: Math.round((6 + rnd() * 2.4) * 10) / 10,
        note: yr === "2026" ? "Musim berjalan" : null,
      });
    }
  }
  await insertMany(s.playerSeasonHistory, historyRows);

  /* ── Badge awards ──────────────────────────────────────────────── */
  console.log("→ Lencana");
  for (const tour of tournaments) {
    const ts = statRows
      .filter((r) => r.tournamentId === tour.id && (r.appearances ?? 0) > 0)
      .map((r) => ({ r, p: P.find((p) => p.id === r.playerId)! }));
    if (!ts.length) continue;
    const topBy = (k: "goals" | "assists" | "score") =>
      [...ts].sort((a, b) => ((b.r[k] as number) ?? 0) - ((a.r[k] as number) ?? 0))[0];
    const glove = [...ts]
      .filter((x) => x.p.position === "GK")
      .sort((a, b) => (b.r.cleanSheets ?? 0) - (a.r.cleanSheets ?? 0))[0];
    const add = (code: string, playerId?: string) => {
      if (!playerId) return;
      badgeRows.push({
        playerId,
        badgeId: badgeByCode[code].id,
        tournamentId: tour.id,
        context: tour.name,
        awardedAt: daysAgo(int(1, 30)),
      });
    };
    add("top_scorer", topBy("goals")?.p.id);
    add("playmaker", topBy("assists")?.p.id);
    add("golden_glove", glove?.p.id);
    add("mvp_tournament", topBy("score")?.p.id);
    add("rising_talent", topBy("score")?.p.id);
    // hat-tricks
    const perMatch: Record<string, Record<string, number>> = {};
    eventRows
      .filter((e) => (e.type === "goal" || e.type === "penalty_goal") && e.playerId)
      .forEach((e) => {
        perMatch[e.matchId!] ??= {};
        perMatch[e.matchId!][e.playerId!] = (perMatch[e.matchId!][e.playerId!] ?? 0) + 1;
      });
    const tourMatchIds = new Set(
      insertedMatches.filter((m) => m.tournamentId === tour.id).map((m) => m.id),
    );
    for (const [mid, tally] of Object.entries(perMatch)) {
      if (!tourMatchIds.has(mid)) continue;
      for (const [pid, n] of Object.entries(tally)) if (n >= 3) add("hat_trick", pid);
    }
    ts.slice(0, 6).forEach((x) => add("debut", x.p.id));
  }
  const seen = new Set<string>();
  const dedupBadges = badgeRows.filter((b) => {
    const k = `${b.playerId}:${b.badgeId}:${b.context}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (dedupBadges.length) await insertMany(s.playerBadges, dedupBadges);

  /* ── Audit logs ────────────────────────────────────────────────── */
  console.log("→ Jejak audit");
  const actions: [string, string, string][] = [
    ["player.verify", "player", "Memverifikasi registrasi pemain"],
    ["player.flag", "player", "Menandai data pemain untuk klarifikasi"],
    ["match.confirm", "match", "Mengonfirmasi hasil pertandingan"],
    ["match.event.create", "match", "Mencatat kejadian pertandingan"],
    ["tournament.status", "tournament", "Mengubah status turnamen"],
    ["fixture.generate", "tournament", "Membuat jadwal pertandingan otomatis"],
    ["formula.activate", "scoring_formula", "Mengaktifkan formula penilaian"],
    ["import.commit", "import_batch", "Menyelesaikan impor data massal"],
    ["referee.assign", "match", "Menugaskan wasit ke pertandingan"],
    ["standings.recompute", "tournament", "Menghitung ulang klasemen"],
  ];
  const auditRows: (typeof s.auditLogs.$inferInsert)[] = [];
  for (let i = 0; i < 42; i++) {
    const [action, entity, summary] = pick(actions);
    const actor = pick(users.filter((u) => ["admin", "operator", "referee"].includes(u.role)));
    auditRows.push({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entityType: entity,
      summary: `${summary}${entity === "player" ? ` — ${fullName()}` : ""}`,
      createdAt: daysAgo(rnd() * 60),
    });
  }
  await insertMany(s.auditLogs, auditRows);

  /* ── AI reports (demo) ─────────────────────────────────────────── */
  console.log("→ Laporan AI (demo)");
  const topCareer = [...statRows]
    .filter((r) => r.season === "career" && (r.goals ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
    .map((r) => P.find((p) => p.id === r.playerId)!);
  const aiRows: (typeof s.aiReports.$inferInsert)[] = [];
  if (topCareer[0]) {
    aiRows.push({
      kind: "player_analysis",
      subjectType: "player",
      subjectId: topCareer[0].id,
      subjectLabel: topCareer[0].fullName,
      model: "demo",
      result: {
        headline: `${topCareer[0].fullName} — penyerang dengan naluri gol di atas rata-rata kelompok umurnya`,
        summary:
          "Analisis berbasis 3 musim data LigaLokal menunjukkan konsistensi kontribusi gol dan pergerakan tanpa bola yang matang. Rekomendasi: percepatan ke jenjang pembinaan berikutnya disertai program penguatan fisik terukur.",
        sections: [
          {
            title: "Kekuatan",
            body: "Penyelesaian akhir di kotak penalti, antisipasi bola rebound, dan etos kerja pressing lini depan.",
            bullets: [
              "Konversi peluang persentil 88",
              "Rata-rata 2,4 tembakan tepat sasaran per laga",
              "Disiplin tinggi — tanpa kartu merah",
            ],
          },
          {
            title: "Area pengembangan",
            body: "Keterlibatan pada fase build-up dan variasi finishing kaki lemah.",
            bullets: ["Umpan kunci di bawah median gelandang serang", "Perlu penguatan duel udara"],
          },
          {
            title: "Rekomendasi jenjang",
            body: "Layak dipromosikan ke kelompok umur di atasnya musim depan; pantau beban menit bermain agar tidak overload.",
          },
        ],
        ratings: [
          { label: "Finishing", value: 88 },
          { label: "Pergerakan", value: 82 },
          { label: "Fisik", value: 64 },
          { label: "Kreativitas", value: 58 },
          { label: "Disiplin", value: 90 },
        ],
        recommendations: [
          "Promosi kelompok umur",
          "Program strength & conditioning individual",
          "Uji coba lawan level lebih tinggi",
        ],
        tags: ["penyerang", "prioritas-pemantauan"],
      },
      createdBy: admin.id,
      createdAt: daysAgo(3),
    });
  }
  aiRows.push({
    kind: "competition_insight",
    subjectType: "tournament",
    subjectId: tournaments[0].id,
    subjectLabel: tournaments[0].name,
    model: "demo",
    result: {
      headline: "Tren paruh musim Liga Pelajar U-14: keunggulan tim dengan transisi cepat",
      summary:
        "Tim papan atas mencetak 61% golnya dalam 10 detik pertama setelah merebut bola. Wasit mencatat penurunan pelanggaran keras 14% dibanding seri sebelumnya.",
      sections: [
        {
          title: "Pola menonjol",
          body: "Gol dari serangan balik meningkat, sementara produktivitas bola mati stagnan.",
          bullets: [
            "Serangan balik: 38% dari total gol",
            "Bola mati: 12% dari total gol",
            "Rata-rata gol per laga: 3,1",
          ],
        },
        {
          title: "Rekomendasi operator",
          body: "Pertimbangkan kuota menit bermain minimum untuk pemerataan pengembangan pemain cadangan.",
        },
      ],
      ratings: [
        { label: "Kompetitivitas", value: 72 },
        { label: "Fair play", value: 84 },
        { label: "Produktivitas gol", value: 68 },
      ],
      tags: ["liga", "paruh-musim"],
    },
    createdBy: operator.id,
    createdAt: daysAgo(6),
  });
  await db.insert(s.aiReports).values(aiRows);

  await db.insert(s.scoutShortlists).values({
    name: "Kandidat gelandang serang KU-12",
    query: "gelandang serang KU-12 dengan assist banyak dan visi bermain baik",
    ownerId: scout.id,
    items: [...statRows]
      .filter((r) => r.tournamentId === tournaments[1].id && (r.assists ?? 0) >= 1)
      .sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))
      .slice(0, 5)
      .map((r) => {
        const p = P.find((x) => x.id === r.playerId)!;
        return {
          playerId: p.id,
          name: p.fullName,
          reason: `${r.assists} assist, ${r.keyPasses} umpan kunci — kreator serangan utama klubnya`,
          score: r.score ?? 0,
        };
      }),
    createdAt: daysAgo(2),
  });

  /* ── Import batches (history) ──────────────────────────────────── */
  console.log("→ Riwayat impor");
  const stageSet = (over: Record<string, "passed" | "failed" | "running" | "pending">) =>
    [
      { key: "upload", label: "1 · Unggah & Baca Berkas" },
      { key: "schema", label: "2 · Validasi Skema Kolom" },
      { key: "normalize", label: "3 · Normalisasi Tipe & Format" },
      { key: "rules", label: "4 · Validasi Aturan Bisnis" },
      { key: "dedupe", label: "5 · Deteksi Duplikasi (Fuzzy Matching)" },
      { key: "crossref", label: "6 · Pencocokan Referensi (Klub/Venue)" },
      { key: "review", label: "7 · Antrian Tinjauan Manual" },
      { key: "commit", label: "8 · Commit ke Sistem & Jejak Audit" },
    ].map((s) => ({
      key: s.key,
      label: s.label,
      status: over[s.key] ?? "passed",
    }));

  const [batchA, batchB] = await insertReturning(db, s.importBatches, [
      {
        entity: "players",
        fileName: "registrasi-pemain-liga-u14-gelombang1.csv",
        status: "completed",
        totalRows: 84,
        validRows: 71,
        errorRows: 4,
        duplicateRows: 6,
        reviewRows: 3,
        importedRows: 74,
        stages: stageSet({ schema: "failed" }),
        uploadedBy: operator.id,
        createdAt: daysAgo(58),
        completedAt: daysAgo(58),
      },
      {
        entity: "clubs",
        fileName: "klub-peserta-piala-garuda-muda.csv",
        status: "completed",
        totalRows: 12,
        validRows: 12,
        errorRows: 0,
        duplicateRows: 0,
        reviewRows: 0,
        importedRows: 12,
        stages: stageSet({}),
        uploadedBy: admin.id,
        createdAt: daysAgo(41),
        completedAt: daysAgo(41),
      },
    ]);

  await db.insert(s.importRows).values(
    [
      { batchId: batchA.id, rowNumber: 2, raw: { full_name: "Arya Pratama", dob: "2012-05-14", position: "FW", club_short: "GMF" }, status: "imported" as const, issues: [] },
      { batchId: batchA.id, rowNumber: 3, raw: { full_name: "Arya Pratama", dob: "2012-05-14", position: "FW", club_short: "GMF" }, status: "duplicate" as const, issues: [], matchCandidateName: "Baris 2 dalam berkas ini", matchScore: 1 },
      { batchId: batchA.id, rowNumber: 4, raw: { full_name: "Bima N", dob: "salah-format", position: "MF" }, status: "error" as const, issues: [{ field: "dob", code: "format", message: "Tanggal lahir harus format YYYY-MM-DD", severity: "error" as const }] },
      { batchId: batchA.id, rowNumber: 5, raw: { full_name: "Candra Wijaya", dob: "2012-08-01", position: "DF", club_short: "ZZZ" }, status: "imported" as const, issues: [{ field: "club_short", code: "crossref", message: "Klub \"ZZZ\" tidak ditemukan — dibiarkan tanpa klub", severity: "warning" as const }] },
      { batchId: batchB.id, rowNumber: 2, raw: { name: "Bogor Kencana FC", short_name: "BKF", city: "Bogor" }, status: "imported" as const, issues: [] },
    ],
  );

  console.log("\n✓ Seed selesai.");
  console.log(
    `  ${users.length} pengguna · ${clubs.length} klub · ${P.length} pemain · ${referees.length} wasit · ${coaches.length} pelatih · ${venues.length} venue`,
  );
  console.log(
    `  ${tournaments.length} turnamen · ${insertedMatches.length} pertandingan · ${eventRows.length} kejadian`,
  );
  console.log(`  Masuk: admin@ligalokal.id / ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ Seed gagal:", e);
    process.exit(1);
  });
