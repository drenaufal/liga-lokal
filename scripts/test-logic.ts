/**
 * Logic checks that need no database: position helpers, the match-statistics
 * ledger and the schedule-upload parser. Run with `npm run test:logic`.
 */
import { buildMatchLines } from "@/lib/match-lines";
import { expandPosition, parsePosition, positionLine } from "@/lib/positions";
import { parseSchedule, summarizeSchedule, type ScheduleContext } from "@/lib/schedule-import";

let failures = 0;
const ok = (cond: unknown, label: string) => {
  if (!cond) failures++;
  console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${label}`);
};

/* ── positions ─────────────────────────────────────────────────────────── */
console.log("\n[positions]");
ok(positionLine("CB") === "DF" && positionLine("WF") === "MF" && positionLine("RW") === "FW" && positionLine("GK") === "GK", "each role maps to its line");
ok(expandPosition("DF").length === 4 && expandPosition("CB").join() === "CB" && expandPosition("GK").join() === "GK", "a filter value is a role or a whole line");
ok(expandPosition("nope").length === 0 && expandPosition("").length === 0, "unknown / empty filter matches nothing");
const legacy = parsePosition("fw");
ok(legacy?.role === "ST" && legacy.legacy, "old four-way code maps to a default role and is flagged");
ok(parsePosition("cmf")?.role === "CMF" && parsePosition("cmf")?.legacy === false, "specific roles are accepted in any case");
ok(parsePosition("zz") === null && parsePosition("") === null, "garbage is rejected");

/* ── match statistics ledger ───────────────────────────────────────────── */
console.log("\n[match lines]");
const lines = buildMatchLines({
  length: 60,
  lineups: [
    { playerId: "S1", clubId: "H", role: "starter" },
    { playerId: "S2", clubId: "H", role: "starter" },
    { playerId: "B1", clubId: "H", role: "substitute" },
    { playerId: "B2", clubId: "H", role: "substitute" },
  ],
  events: [
    { type: "substitution", minute: 30, clubId: "H", playerId: "S2", relatedPlayerId: "B1" },
    { type: "goal", minute: 40, clubId: "H", playerId: "B1", relatedPlayerId: "S1" },
    { type: "assist", minute: 40, clubId: "H", playerId: "S1", relatedPlayerId: "B1" },
    { type: "yellow_card", minute: 50, clubId: "H", playerId: "S1", relatedPlayerId: null },
    { type: "shot_on", minute: 51, clubId: "A", playerId: "X9", relatedPlayerId: null },
    { type: "var_check", minute: 60, clubId: "H", playerId: "B1", relatedPlayerId: null, detail: { award: "MOTM" } },
  ],
});
const by = Object.fromEntries(lines.map((l) => [l.playerId, l]));
ok(by.S1.minutesPlayed === 60 && by.S1.assists === 1 && by.S1.yellowCards === 1, "starter plays the full match; assist and yellow counted");
ok(by.S2.minutesPlayed === 30, "a starter substituted off has 30 minutes");
ok(by.B1.minutesPlayed === 30 && by.B1.goals === 1 && by.B1.shotsOnTarget === 1 && by.B1.motm === 1, "a substitute counts from coming on; a goal is also a shot on target; MOTM counted");
ok(!by.B2, "an unused substitute is not a participant");
ok(by.X9?.appearances === 1 && by.X9.minutesPlayed === 60 && by.X9.clubId === "A", "a player with only events (no line-up) is assumed to play the whole match, club from the event");
const cards = buildMatchLines({
  length: 90,
  lineups: [],
  events: [
    { type: "yellow_card", minute: 20, clubId: "H", playerId: "P", relatedPlayerId: null },
    { type: "second_yellow", minute: 70, clubId: "H", playerId: "P", relatedPlayerId: null },
  ],
});
ok(cards[0].yellowCards === 2 && cards[0].redCards === 0, "a second yellow counts as a yellow card (the dismissal is not a separate red)");

/* ── schedule upload ───────────────────────────────────────────────────── */
console.log("\n[schedule upload]");
const ctx: ScheduleContext = {
  format: "league",
  teams: [
    { clubId: "c-gmf", short: "GMF", name: "Garuda Muda FC" },
    { clubId: "c-cpf", short: "CPF", name: "Ciputat FC" },
    { clubId: "c-bsa", short: "BSA", name: "Bekasi SA" },
  ],
  venues: [{ id: "v1", name: "Lapangan ABC Senayan" }],
  referees: [
    { id: "r1", license: "WST-2026-1001", name: "Pak Wasit", valid: true },
    { id: "r2", license: "WST-2026-1002", name: "Pak Lama", valid: false },
  ],
  existing: [
    { homeClubId: "c-gmf", awayClubId: "c-bsa", stage: "league", round: 1, scheduledAt: new Date(Date.UTC(2026, 9, 17, 8, 30)), status: "scheduled" },
  ],
};

let r = parseSchedule(
  `home_short,away_short,date,time,round,venue,referee_license
gmf,CPF,2026-10-24,15:30,2,Lapangan ABC Senayan,WST-2026-1001
CPF,BSA,24/10/2026,09.05,2,,
`,
  ctx,
);
ok(!r.error && r.rows.length === 2 && r.rows[0].status === "ok" && r.rows[0].homeClubId === "c-gmf", "club codes resolve case-insensitively");
ok(r.rows[0].scheduledAt === "2026-10-24T08:30:00.000Z", "15:30 WIB is stored as 08:30 UTC");
ok(r.rows[1].scheduledAt === "2026-10-24T02:05:00.000Z", "DD/MM/YYYY and 09.05 are understood");
ok(r.rows[0].venueId === "v1" && r.rows[0].refereeId === "r1" && r.rows[0].stage === "league" && r.rows[0].round === 2, "venue, referee, default stage and round resolved");

r = parseSchedule("﻿tuan_rumah;tamu;tanggal;jam;pekan\r\nGMF;CPF;2026-11-01;16:00;3\r\n", ctx);
ok(!r.error && r.rows[0]?.status === "ok" && r.rows[0].round === 3, "semicolon file with Indonesian column names and a BOM works");

r = parseSchedule(
  `home_short,away_short,date,time,round,stage,venue,referee_license
XYZ,CPF,2026-10-24,15:30,1,,,
GMF,GMF,2026-10-24,15:30,1,,,
GMF,CPF,2026-13-45,25:99,1,,,
GMF,CPF,2026-10-25,15:30,1,babak-aneh,,
GMF,CPF,2026-10-26,15:30,0,,,
GMF,CPF,2026-10-27,15:30,1,,Lapangan Hantu,WST-2026-9999
GMF,CPF,2026-10-28,15:30,5,,,WST-2026-1002
GMF,BSA,2026-10-17,15:30,1,,,
CPF,BSA,2026-10-29,15:30,1,,,
CPF,BSA,2026-10-29,15:30,1,,,
`,
  ctx,
);
const line = (n: number) => r.rows.find((x) => x.line === n)!;
ok(line(2).status === "error" && line(2).issues[0].includes("XYZ"), "unknown club code is an error");
ok(line(3).status === "error" && line(3).issues[0].includes("sama"), "home = away is an error");
ok(line(4).status === "error" && line(4).issues.length >= 2, "bad date and bad time are reported separately");
ok(line(5).status === "error" && line(6).status === "error", "unknown stage and round 0 are errors");
ok(line(7).status === "warning" && line(7).venueId === null && line(7).refereeId === null, "unknown venue / license only warn and are left blank");
ok(line(8).status === "warning" && line(8).refereeId === null, "an expired referee license warns and is left blank");
ok(line(9).status === "duplicate", "a match already in the tournament is skipped");
ok(line(10).status === "ok" && line(11).status === "duplicate", "a repeat inside the file is skipped");
const sum = summarizeSchedule(r.rows);
ok(sum.importable === 3 && sum.errors === 5 && sum.duplicates === 2, `summary counts add up (${sum.importable} ok / ${sum.errors} errors / ${sum.duplicates} duplicates)`);

r = parseSchedule("home_short,away_short,date,time,round\nGMF,CPF,2026-11-07,15:30,2\nGMF,BSA,2026-11-07,16:30,2\n", ctx);
ok(r.rows[0].status === "ok" && r.rows[1].status === "warning", "the same club 60 minutes apart is flagged");
ok(!!parseSchedule("", ctx).error && !!parseSchedule("a,b,c\n1,2,3\n", ctx).error, "an empty file and missing columns are rejected as a whole");

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
