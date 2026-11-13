import { parseCsv } from "@/lib/ingestion";
import { defaultStage } from "@/lib/ku";
import { createT, type TFunction } from "@/lib/i18n/translate";

const INDONESIAN = createT("id", {});

/**
 * Reads a match schedule from CSV and checks every row against the
 * KU it is being uploaded into. Pure (no database): the caller
 * supplies the participants, venues, referees and existing matches.
 */

export const MAX_SCHEDULE_ROWS = 500;

/** CSV times are wall-clock WIB (UTC+7), like everywhere else in the app. */
export const WIB_OFFSET_HOURS = 7;
/** Two matches of one club closer than this are flagged as a clash. */
export const CLASH_MINUTES = 90;

const COLUMN_ALIASES = {
  home_short: ["home_short", "home", "tuan_rumah", "kandang"],
  away_short: ["away_short", "away", "tamu", "tandang"],
  date: ["date", "tanggal", "tgl"],
  time: ["time", "jam", "waktu", "kickoff"],
  round: ["round", "pekan", "putaran"],
  stage: ["stage", "fase", "tahap"],
  group: ["group", "grup"],
  venue: ["venue", "lokasi", "tempat", "stadion"],
  referee_license: ["referee_license", "lisensi_wasit", "wasit", "referee"],
  bracket_slot: ["bracket_slot", "slot"],
} as const;
type Column = keyof typeof COLUMN_ALIASES;

const REQUIRED: Column[] = ["home_short", "away_short", "date", "time"];

const STAGES: Record<string, string> = {
  league: "league",
  liga: "league",
  group: "group",
  grup: "group",
  "fase grup": "group",
  round_of_32: "round_of_32",
  "32 besar": "round_of_32",
  round_of_16: "round_of_16",
  "16 besar": "round_of_16",
  quarter: "quarter",
  perempat: "quarter",
  "perempat final": "quarter",
  semi: "semi",
  semifinal: "semi",
  final: "final",
  third_place: "third_place",
  "tempat ketiga": "third_place",
  "juara 3": "third_place",
};

export type ScheduleContext = {
  format: string;
  teams: { clubId: string; short: string; name: string }[];
  venues: { id: string; name: string }[];
  referees: { id: string; license: string; name: string; valid: boolean }[];
  /** Matches already in the tournament (those about to be replaced must be left out). */
  existing: {
    homeClubId: string | null;
    awayClubId: string | null;
    stage: string;
    round: number;
    scheduledAt: Date;
    status: string;
  }[];
};

export type ScheduleRow = {
  /** Line number in the file (the header is line 1). */
  line: number;
  status: "ok" | "warning" | "error" | "duplicate";
  issues: string[];
  home: string;
  away: string;
  homeName?: string;
  awayName?: string;
  scheduledAt?: string;
  stage?: string;
  round?: number;
  group?: string | null;
  bracketSlot?: string | null;
  venueName?: string | null;
  refereeName?: string | null;
  // resolved references, used when importing
  homeClubId?: string;
  awayClubId?: string;
  venueId?: string | null;
  refereeId?: string | null;
};

export type ScheduleParse = {
  rows: ScheduleRow[];
  /** The file as a whole is unusable (empty, missing columns, too long). */
  error?: string;
};

/** Excel in Indonesian locales saves CSV with `;`; accept that and tabs too. */
export function detectDelimiter(text: string) {
  const first = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t"]) {
    const n = first.split(d).length - 1;
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

const norm = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");

function pickColumns(headers: string[]) {
  const map = {} as Record<Column, string | undefined>;
  for (const col of Object.keys(COLUMN_ALIASES) as Column[]) {
    map[col] = headers.find((h) => (COLUMN_ALIASES[col] as readonly string[]).includes(norm(h)));
  }
  return map;
}

/** "2026-10-17" or "17/10/2026" or "17-10-2026". */
export function parseDate(raw: string): { y: number; m: number; d: number } | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) [d, m, y] = [+mt[1], +mt[2], +mt[3]];
  else return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return { y, m, d };
}

/** "15:30", "15.30", "9:05", "15:30:00". */
export function parseTime(raw: string): { hh: number; mm: number } | null {
  const mt = raw.trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if (!mt) return null;
  const hh = +mt[1];
  const mm = +mt[2];
  return hh > 23 || mm > 59 ? null : { hh, mm };
}

/** `t` is the language of the messages in the result (Indonesian when omitted). */
export function parseSchedule(csv: string, ctx: ScheduleContext, t: TFunction = INDONESIAN): ScheduleParse {
  const text = csv.replace(/^﻿/, "");
  if (!text.trim()) return { rows: [], error: t("Berkas kosong.") };

  const { headers, rows: raw } = parseCsv(text, detectDelimiter(text));
  const cols = pickColumns(headers);
  const missing = REQUIRED.filter((c) => !cols[c]);
  if (missing.length)
    return {
      rows: [],
      error: t("Kolom wajib tidak ditemukan: {cols}. Gunakan templat CSV dari tombol “Unduh templat”.", { cols: missing.join(", ") }),
    };
  if (raw.length === 0) return { rows: [], error: t("Tidak ada baris data di bawah judul kolom.") };
  if (raw.length > MAX_SCHEDULE_ROWS) return { rows: [], error: t("Maksimal {n} baris per unggahan.", { n: MAX_SCHEDULE_ROWS }) };

  const get = (r: Record<string, string>, c: Column) => (cols[c] ? (r[cols[c]!] ?? "").trim() : "");
  const teamByShort = new Map(ctx.teams.map((tm) => [tm.short.toLowerCase(), tm]));
  const venueByName = new Map(ctx.venues.map((v) => [v.name.trim().toLowerCase(), v]));
  const refByLicense = new Map(ctx.referees.map((r) => [r.license.trim().toLowerCase(), r]));
  const teamName = (id: string) => ctx.teams.find((tm) => tm.clubId === id)?.short ?? "SSB";

  const keyOf = (home: string, away: string, stage: string, round: number) => `${home}|${away}|${stage}|${round}`;
  const existingKeys = new Set(
    ctx.existing
      .filter((m) => m.homeClubId && m.awayClubId)
      .map((m) => keyOf(m.homeClubId!, m.awayClubId!, m.stage, m.round)),
  );
  const seen = new Map<string, number>();

  // every (club, time) already on the calendar, to spot a club playing twice at once
  const calendar: { clubId: string; at: number; label: string }[] = [];
  for (const m of ctx.existing) {
    if (m.status === "completed" || m.status === "cancelled") continue;
    for (const id of [m.homeClubId, m.awayClubId]) {
      if (id) calendar.push({ clubId: id, at: m.scheduledAt.getTime(), label: t("jadwal yang sudah ada") });
    }
  }

  const rows: ScheduleRow[] = [];
  raw.forEach((r, i) => {
    const line = i + 2;
    if (Object.values(r).every((v) => !v.trim())) return; // blank line

    const home = get(r, "home_short");
    const away = get(r, "away_short");
    const row: ScheduleRow = { line, status: "ok", issues: [], home, away };
    const error = (message: string) => {
      row.issues.push(message);
      row.status = "error";
    };
    const warn = (message: string) => {
      row.issues.push(message);
      if (row.status === "ok") row.status = "warning";
    };

    const h = teamByShort.get(home.toLowerCase());
    const a = teamByShort.get(away.toLowerCase());
    if (!home) error(t("Tuan rumah kosong"));
    else if (!h) error(t("SSB “{club}” bukan peserta KU ini", { club: home }));
    if (!away) error(t("Tamu kosong"));
    else if (!a) error(t("SSB “{club}” bukan peserta KU ini", { club: away }));
    if (h && a && h.clubId === a.clubId) error(t("Tuan rumah dan tamu tidak boleh SSB yang sama"));
    if (h) {
      row.homeClubId = h.clubId;
      row.homeName = h.name;
    }
    if (a) {
      row.awayClubId = a.clubId;
      row.awayName = a.name;
    }

    // when
    const d = parseDate(get(r, "date"));
    const clock = parseTime(get(r, "time"));
    if (!d) error(t("Tanggal “{value}” tidak valid (pakai YYYY-MM-DD atau DD/MM/YYYY)", { value: get(r, "date") }));
    if (!clock) error(t("Jam “{value}” tidak valid (pakai HH:mm)", { value: get(r, "time") }));
    let at: Date | null = null;
    if (d && clock) {
      at = new Date(Date.UTC(d.y, d.m - 1, d.d, clock.hh - WIB_OFFSET_HOURS, clock.mm));
      row.scheduledAt = at.toISOString();
    }

    // stage / round / group
    const group = get(r, "group").toUpperCase();
    const rawStage = get(r, "stage").toLowerCase();
    // no stage column: a Cup starts where its bracket does (3–4 SSB → semi-final, 5–8 → quarter-final, …)
    let stage = group ? "group" : defaultStage(ctx.format, ctx.teams.length);
    if (rawStage) {
      const s = STAGES[rawStage];
      if (!s) error(t("Fase “{value}” tidak dikenal ({list})", { value: get(r, "stage"), list: [...new Set(Object.values(STAGES))].join(", ") }));
      else stage = s;
    }
    const rawRound = get(r, "round");
    let round = 1;
    if (rawRound) {
      const n = Number(rawRound);
      if (!Number.isInteger(n) || n < 1 || n > 99) error(t("Pekan “{value}” harus bilangan 1–99", { value: rawRound }));
      else round = n;
    }
    if (group && group.length > 2) error(t("Grup “{value}” maksimal 2 karakter", { value: group }));
    row.stage = stage;
    row.round = round;
    row.group = group || null;
    row.bracketSlot = get(r, "bracket_slot") || null;

    // venue / referee (optional): unknown values are dropped with a warning
    const venueRaw = get(r, "venue");
    row.venueId = null;
    if (venueRaw) {
      const v = venueByName.get(venueRaw.toLowerCase());
      if (v) {
        row.venueId = v.id;
        row.venueName = v.name;
      } else warn(t("Venue “{value}” tidak dikenal — dikosongkan", { value: venueRaw }));
    }
    const refRaw = get(r, "referee_license");
    row.refereeId = null;
    if (refRaw) {
      const ref = refByLicense.get(refRaw.toLowerCase());
      if (!ref) warn(t("Nomor lisensi wasit “{value}” tidak dikenal — dikosongkan", { value: refRaw }));
      else if (!ref.valid) warn(t("Lisensi {name} tidak berlaku — dikosongkan", { name: ref.name }));
      else {
        row.refereeId = ref.id;
        row.refereeName = ref.name;
      }
    }

    // duplicates, then clashes (only for rows that are otherwise fine)
    if (row.status !== "error" && h && a) {
      const key = keyOf(h.clubId, a.clubId, stage, round);
      if (existingKeys.has(key)) {
        row.status = "duplicate";
        row.issues.push(t("Sudah ada di jadwal turnamen — dilewati"));
      } else if (seen.has(key)) {
        row.status = "duplicate";
        row.issues.push(t("Sama dengan baris {n} — dilewati", { n: seen.get(key) ?? 0 }));
      } else {
        seen.set(key, line);
        if (at) {
          for (const id of [h.clubId, a.clubId]) {
            const clash = calendar.find((c) => c.clubId === id && Math.abs(c.at - at!.getTime()) < CLASH_MINUTES * 60_000);
            if (clash) warn(t("{club} sudah bermain di waktu berdekatan ({label}) — periksa jadwal", { club: teamName(id), label: clash.label }));
          }
          calendar.push({ clubId: h.clubId, at: at.getTime(), label: t("baris {n}", { n: line }) });
          calendar.push({ clubId: a.clubId, at: at.getTime(), label: t("baris {n}", { n: line }) });
        }
      }
    }
    rows.push(row);
  });

  if (rows.length === 0) return { rows: [], error: t("Tidak ada baris data yang terbaca.") };
  return { rows };
}

export function summarizeSchedule(rows: ScheduleRow[]) {
  return {
    total: rows.length,
    importable: rows.filter((r) => r.status === "ok" || r.status === "warning").length,
    warnings: rows.filter((r) => r.status === "warning").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    errors: rows.filter((r) => r.status === "error").length,
  };
}
