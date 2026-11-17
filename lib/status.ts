import {
  LINE_LABEL,
  PLAYER_POSITIONS,
  POSITION_NAME,
  positionLine,
  type PositionLine,
} from "@/lib/positions";
import type { TFunction } from "@/lib/i18n/translate";
import { msg } from "@/lib/i18n/translate";

type Tone =
  | "neutral"
  | "brand"
  | "info"
  | "warn"
  | "danger"
  | "success"
  | "violet"
  | "magenta";

type Meta = { label: string; tone: Tone };

export const VERIFICATION: Record<string, Meta> = {
  verified: { label: msg("Terverifikasi"), tone: "success" },
  pending: { label: msg("Menunggu"), tone: "info" },
  flagged: { label: msg("Ditandai"), tone: "warn" },
  rejected: { label: msg("Ditolak"), tone: "danger" },
};

export const REFEREE_STATUS: Record<string, Meta> = {
  active: { label: msg("Aktif"), tone: "success" },
  expiring: { label: msg("Akan Kedaluwarsa"), tone: "warn" },
  expired: { label: msg("Kedaluwarsa"), tone: "danger" },
  revoked: { label: msg("Dicabut"), tone: "neutral" },
};

/** Referee license levels, lowest to highest. */
export const REFEREE_LICENSE_LEVELS = ["C-3", "C-2", "C-1", "Nasional"];
export const REFEREE_SPECIALTIES = ["Wasit", "Asisten Wasit", "Wasit ke-4"];

/** Display name of a stored referee specialty. */
export function refereeSpecialtyLabel(t: TFunction, value: string) {
  return value === "Wasit" ? t("Wasit::spesialisasi") : t.dyn(value);
}

export const COACH_LICENSE_LEVELS = ["D Nasional", "C AFC", "B AFC", "A AFC", "Pro AFC"];
export const COACH_SPECIALTIES = [
  "Pelatih Kepala",
  "Asisten Pelatih",
  "Pelatih Kiper",
  "Pelatih Fisik",
];

/** A license counts as "expiring" this many days before its expiry date. */
export const LICENSE_EXPIRING_DAYS = 45;

export type LicenseStatus = "active" | "expiring" | "expired" | "revoked";

/** Derives a license status from its expiry date (YYYY-MM-DD) unless revoked. */
export function licenseStatus(expiry: string, revoked = false, today = new Date()): LicenseStatus {
  if (revoked) return "revoked";
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = expiry.split("-").map(Number);
  const days = (new Date(y, m - 1, d).getTime() - start) / 86_400_000;
  if (days < 0) return "expired";
  if (days < LICENSE_EXPIRING_DAYS) return "expiring";
  return "active";
}

export const TOURNAMENT_STATUS: Record<string, Meta> = {
  draft: { label: msg("Draf"), tone: "neutral" },
  registration: { label: msg("Registrasi"), tone: "info" },
  verification: { label: msg("Verifikasi"), tone: "violet" },
  ready: { label: msg("Siap"), tone: "brand" },
  ongoing: { label: msg("Berlangsung"), tone: "success" },
  completed: { label: msg("Selesai"), tone: "neutral" },
  archived: { label: msg("Arsip"), tone: "neutral" },
};

export const MATCH_STATUS: Record<string, Meta> = {
  scheduled: { label: msg("Terjadwal"), tone: "info" },
  live: { label: msg("Langsung"), tone: "danger" },
  halftime: { label: msg("Jeda"), tone: "warn" },
  completed: { label: msg("Selesai"), tone: "neutral" },
  postponed: { label: msg("Ditunda"), tone: "warn" },
  cancelled: { label: msg("Dibatalkan"), tone: "neutral" },
};

export const RESULT_STATUS: Record<string, Meta> = {
  unconfirmed: { label: msg("Belum Dikonfirmasi"), tone: "warn" },
  confirmed: { label: msg("Terkonfirmasi"), tone: "success" },
  disputed: { label: msg("Disengketakan"), tone: "danger" },
  amended: { label: msg("Dikoreksi"), tone: "violet" },
};

export const REGISTRATION_STATUS: Record<string, Meta> = {
  invited: { label: msg("Diundang"), tone: "neutral" },
  registered: { label: msg("Terdaftar"), tone: "info" },
  verified: { label: msg("Terverifikasi"), tone: "success" },
  rejected: { label: msg("Ditolak"), tone: "danger" },
  withdrawn: { label: msg("Mengundurkan Diri"), tone: "neutral" },
};

export const IMPORT_BATCH_STATUS: Record<string, Meta> = {
  uploaded: { label: msg("Terunggah"), tone: "neutral" },
  validating: { label: msg("Validasi"), tone: "info" },
  validated: { label: msg("Tervalidasi"), tone: "info" },
  staged: { label: "Staging", tone: "violet" },
  needs_review: { label: msg("Perlu Tinjauan"), tone: "warn" },
  importing: { label: msg("Mengimpor"), tone: "info" },
  completed: { label: msg("Selesai"), tone: "success" },
  failed: { label: msg("Gagal"), tone: "danger" },
};

const LINE_TONE: Record<PositionLine, Tone> = {
  GK: "warn",
  DF: "info",
  MF: "success",
  FW: "magenta",
};

/**
 * Label + colour per stored role ("CB · Bek Tengah"). The old four-way line
 * codes stay as a fallback so a stray "DF" still renders instead of crashing.
 */
export const POSITION: Record<string, { label: string; tone: Tone }> = {
  ...Object.fromEntries(
    PLAYER_POSITIONS.map((p) => [p, { label: `${p} · ${POSITION_NAME[p]}`, tone: LINE_TONE[positionLine(p)] }]),
  ),
  DF: { label: LINE_LABEL.DF, tone: LINE_TONE.DF },
  MF: { label: LINE_LABEL.MF, tone: LINE_TONE.MF },
  FW: { label: LINE_LABEL.FW, tone: LINE_TONE.FW },
};

export const STAGE_LABEL: Record<string, string> = {
  league: msg("Liga"),
  group: msg("Fase Grup"),
  round_of_32: msg("32 Besar"),
  round_of_16: msg("16 Besar"),
  quarter: msg("Perempat Final"),
  semi: msg("Semifinal"),
  final: "Final",
  third_place: msg("Perebutan Tempat Ketiga"),
};

export const EVENT_LABEL: Record<string, string> = {
  goal: msg("Gol"),
  own_goal: msg("Gol Bunuh Diri"),
  penalty_goal: msg("Gol Penalti"),
  penalty_missed: msg("Penalti Gagal"),
  assist: "Assist",
  shot_on: msg("Tembakan Tepat"),
  shot_off: msg("Tembakan Meleset"),
  save: msg("Penyelamatan"),
  yellow_card: msg("Kartu Kuning"),
  red_card: msg("Kartu Merah"),
  second_yellow: msg("Kartu Kuning Kedua"),
  foul: msg("Pelanggaran"),
  offside: "Offside",
  corner: msg("Tendangan Sudut"),
  substitution: msg("Pergantian"),
  injury: msg("Cedera"),
  var_check: msg("Tinjauan"),
  period: msg("Babak"),
  interception: msg("Intersep"),
  pass: msg("Passing"),
};
