/**
 * Identity / eligibility documents kept for every player. Each maps to a URL
 * column on `players` that points at a private `document` media row (only
 * people who verify registrations can open it).
 */
import { msg } from "@/lib/i18n/translate";

export const PLAYER_DOCUMENTS = [
  {
    key: "kiaUrl",
    short: "KIA",
    label: msg("KIA (Kartu Identitas Anak)"),
    hint: msg("Scan / foto KIA — JPG, PNG, atau PDF · maks 5 MB."),
  },
  {
    key: "kkUrl",
    short: "KK",
    label: msg("Kartu Keluarga (KK)"),
    hint: msg("Halaman KK yang memuat nama pemain — JPG, PNG, atau PDF · maks 5 MB."),
  },
  {
    key: "aktaUrl",
    short: msg("Akta"),
    label: msg("Akta Kelahiran"),
    hint: msg("Dipakai untuk mencocokkan tanggal lahir — JPG, PNG, atau PDF · maks 5 MB."),
  },
  {
    key: "ijazahUrl",
    short: msg("Ijazah"),
    label: msg("Ijazah"),
    hint: msg("Ijazah / surat keterangan lulus terakhir — JPG, PNG, atau PDF · maks 5 MB."),
  },
  {
    key: "raporUrl",
    short: msg("Rapor"),
    label: msg("Rapor"),
    hint: msg("Rapor semester terakhir; gabungkan beberapa halaman menjadi satu PDF · maks 5 MB."),
  },
] as const;

export type PlayerDocumentKey = (typeof PLAYER_DOCUMENTS)[number]["key"];

export const DOCUMENT_KEYS = PLAYER_DOCUMENTS.map((d) => d.key) as PlayerDocumentKey[];

type DocFields = Partial<Record<PlayerDocumentKey, string | null | undefined>>;

/** How many of the documents are on file, and which are missing. */
export function documentCompleteness(p: DocFields) {
  const have = PLAYER_DOCUMENTS.filter((d) => !!p[d.key]);
  const missing = PLAYER_DOCUMENTS.filter((d) => !p[d.key]);
  return { have: have.length, total: PLAYER_DOCUMENTS.length, missing };
}
