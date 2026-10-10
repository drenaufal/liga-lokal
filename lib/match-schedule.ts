import { CLASH_MINUTES, WIB_OFFSET_HOURS, parseDate, parseTime } from "@/lib/schedule-import";
import { STAGES_BY_FORMAT } from "@/lib/ku";

/**
 * Checks one match typed into the "add match" form against the KU it is being
 * added to. Pure (no database): the caller supplies the participants, venues,
 * referees and the matches already scheduled — the same rules the CSV upload
 * applies to each row, but per field so the form can mark the exact input.
 */

export type ManualMatchInput = {
  homeClubId: string;
  awayClubId: string;
  /** YYYY-MM-DD (or DD/MM/YYYY). */
  date: string;
  /** HH:mm, wall-clock WIB. */
  time: string;
  stage: string;
  round: number;
  venueId?: string | null;
  refereeId?: string | null;
  /** Slot in a Cup bracket ("QF1", "SF2" …), optional. */
  bracketSlot?: string | null;
};

export type ManualMatchContext = {
  format: string;
  /** Older cups still have a group stage. */
  hasGroups: boolean;
  teamIds: string[];
  venueIds: string[];
  referees: { id: string; valid: boolean }[];
  /** Matches already in the KU. */
  existing: {
    homeClubId: string | null;
    awayClubId: string | null;
    stage: string;
    round: number;
    scheduledAt: Date;
    status: string;
  }[];
};

export type ManualMatchCheck = {
  /** Field name → message. Non-empty means the match must not be saved. */
  errors: Record<string, string>;
  /** Things worth a second look but not a reason to refuse. */
  warnings: string[];
  /** The kick-off as a UTC instant, when date and time are valid. */
  scheduledAt: Date | null;
};

const SLOT_RE = /^[A-Z0-9]{1,8}$/;

export function checkManualMatch(input: ManualMatchInput, ctx: ManualMatchContext): ManualMatchCheck {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  // who plays
  if (!input.homeClubId) errors.homeClubId = "Pilih tuan rumah";
  else if (!ctx.teamIds.includes(input.homeClubId)) errors.homeClubId = "Bukan peserta KU ini";
  if (!input.awayClubId) errors.awayClubId = "Pilih tamu";
  else if (!ctx.teamIds.includes(input.awayClubId)) errors.awayClubId = "Bukan peserta KU ini";
  if (input.homeClubId && input.homeClubId === input.awayClubId) {
    errors.awayClubId = "Tuan rumah dan tamu tidak boleh SSB yang sama";
  }

  // when
  const d = parseDate(input.date);
  const t = parseTime(input.time);
  if (!d) errors.date = "Tanggal tidak valid";
  if (!t) errors.time = "Jam tidak valid (HH:mm)";
  const scheduledAt = d && t ? new Date(Date.UTC(d.y, d.m - 1, d.d, t.hh - WIB_OFFSET_HOURS, t.mm)) : null;

  // which stage / round
  const stages = [...(STAGES_BY_FORMAT[ctx.format] ?? ["league"]), ...(ctx.hasGroups ? ["group"] : [])];
  if (!stages.includes(input.stage)) errors.stage = "Fase tidak sesuai format KU";
  if (!Number.isInteger(input.round) || input.round < 1 || input.round > 99) errors.round = "Pekan 1–99";
  const slot = input.bracketSlot?.trim().toUpperCase() ?? "";
  if (slot && !SLOT_RE.test(slot)) errors.bracketSlot = "Slot bagan 1–8 huruf/angka, mis. QF1";

  // optional extras
  if (input.venueId && !ctx.venueIds.includes(input.venueId)) errors.venueId = "Venue tidak dikenal";
  if (input.refereeId) {
    const ref = ctx.referees.find((r) => r.id === input.refereeId);
    if (!ref) errors.refereeId = "Wasit tidak dikenal";
    else if (!ref.valid) errors.refereeId = "Lisensi wasit tidak berlaku";
  }

  if (Object.keys(errors).length) return { errors, warnings, scheduledAt };

  // already scheduled? (the same pairing in the same stage and round)
  const dup = ctx.existing.find(
    (m) =>
      m.homeClubId === input.homeClubId &&
      m.awayClubId === input.awayClubId &&
      m.stage === input.stage &&
      m.round === input.round,
  );
  if (dup) errors.awayClubId = "Pertandingan ini sudah ada di jadwal";

  // a club in two places at once
  if (scheduledAt) {
    for (const clubId of [input.homeClubId, input.awayClubId]) {
      const clash = ctx.existing.find(
        (m) =>
          (m.homeClubId === clubId || m.awayClubId === clubId) &&
          m.status !== "completed" &&
          m.status !== "cancelled" &&
          Math.abs(m.scheduledAt.getTime() - scheduledAt.getTime()) < CLASH_MINUTES * 60_000,
      );
      if (clash) warnings.push("Salah satu SSB sudah punya pertandingan di waktu berdekatan — periksa jadwal");
    }
  }

  return { errors, warnings: [...new Set(warnings)], scheduledAt };
}
