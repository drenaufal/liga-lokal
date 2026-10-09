import {
  LINE_LABEL,
  PLAYER_POSITIONS,
  POSITION_NAME,
  positionLine,
  type PositionLine,
} from "@/lib/positions";

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
  verified: { label: "Terverifikasi", tone: "success" },
  pending: { label: "Menunggu", tone: "info" },
  flagged: { label: "Ditandai", tone: "warn" },
  rejected: { label: "Ditolak", tone: "danger" },
};

export const REFEREE_STATUS: Record<string, Meta> = {
  active: { label: "Aktif", tone: "success" },
  expiring: { label: "Akan Kedaluwarsa", tone: "warn" },
  expired: { label: "Kedaluwarsa", tone: "danger" },
  revoked: { label: "Dicabut", tone: "neutral" },
};

/** Coaches use the same license lifecycle as referees. */
export const COACH_STATUS = REFEREE_STATUS;

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
  draft: { label: "Draf", tone: "neutral" },
  registration: { label: "Registrasi", tone: "info" },
  verification: { label: "Verifikasi", tone: "violet" },
  ready: { label: "Siap", tone: "brand" },
  ongoing: { label: "Berlangsung", tone: "success" },
  completed: { label: "Selesai", tone: "neutral" },
  archived: { label: "Arsip", tone: "neutral" },
};

export const MATCH_STATUS: Record<string, Meta> = {
  scheduled: { label: "Terjadwal", tone: "info" },
  live: { label: "Langsung", tone: "danger" },
  halftime: { label: "Jeda", tone: "warn" },
  completed: { label: "Selesai", tone: "neutral" },
  postponed: { label: "Ditunda", tone: "warn" },
  cancelled: { label: "Dibatalkan", tone: "neutral" },
};

export const RESULT_STATUS: Record<string, Meta> = {
  unconfirmed: { label: "Belum Dikonfirmasi", tone: "warn" },
  confirmed: { label: "Terkonfirmasi", tone: "success" },
  disputed: { label: "Disengketakan", tone: "danger" },
  amended: { label: "Dikoreksi", tone: "violet" },
};

export const REGISTRATION_STATUS: Record<string, Meta> = {
  invited: { label: "Diundang", tone: "neutral" },
  registered: { label: "Terdaftar", tone: "info" },
  verified: { label: "Terverifikasi", tone: "success" },
  rejected: { label: "Ditolak", tone: "danger" },
  withdrawn: { label: "Mengundurkan Diri", tone: "neutral" },
};

export const IMPORT_BATCH_STATUS: Record<string, Meta> = {
  uploaded: { label: "Terunggah", tone: "neutral" },
  validating: { label: "Validasi", tone: "info" },
  validated: { label: "Tervalidasi", tone: "info" },
  staged: { label: "Staging", tone: "violet" },
  needs_review: { label: "Perlu Tinjauan", tone: "warn" },
  importing: { label: "Mengimpor", tone: "info" },
  completed: { label: "Selesai", tone: "success" },
  failed: { label: "Gagal", tone: "danger" },
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
  league: "Liga",
  group: "Fase Grup",
  round_of_32: "32 Besar",
  round_of_16: "16 Besar",
  quarter: "Perempat Final",
  semi: "Semifinal",
  final: "Final",
  third_place: "Perebutan Tempat Ketiga",
};

export const EVENT_LABEL: Record<string, string> = {
  goal: "Gol",
  own_goal: "Gol Bunuh Diri",
  penalty_goal: "Gol Penalti",
  penalty_missed: "Penalti Gagal",
  assist: "Assist",
  shot_on: "Tembakan Tepat",
  shot_off: "Tembakan Meleset",
  save: "Penyelamatan",
  yellow_card: "Kartu Kuning",
  red_card: "Kartu Merah",
  second_yellow: "Kartu Kuning Kedua",
  foul: "Pelanggaran",
  offside: "Offside",
  corner: "Tendangan Sudut",
  substitution: "Pergantian",
  injury: "Cedera",
  var_check: "Tinjauan",
  period: "Babak",
  interception: "Intersep",
};
