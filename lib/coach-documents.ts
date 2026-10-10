/**
 * Papers kept for every coach. Each maps to a URL column on `coaches` that
 * points at a private `document` media row (only people who verify
 * registrations can open it) — the same model as lib/player-documents.ts.
 */
export const COACH_DOCUMENTS = [
  {
    key: "licenseDocUrl",
    short: "Lisensi",
    label: "Lisensi kepelatihan",
    hint: "Scan / foto sertifikat lisensi — JPG, PNG, atau PDF · maks 5 MB.",
  },
  {
    key: "ktpUrl",
    short: "KTP",
    label: "KTP",
    hint: "Scan / foto KTP — JPG, PNG, atau PDF · maks 5 MB.",
  },
] as const;

export type CoachDocumentKey = (typeof COACH_DOCUMENTS)[number]["key"];

export const COACH_DOCUMENT_KEYS = COACH_DOCUMENTS.map((d) => d.key) as CoachDocumentKey[];

type DocFields = Partial<Record<CoachDocumentKey, string | null | undefined>>;

/** How many of the documents are on file, and which are missing. */
export function coachDocumentCompleteness(c: DocFields) {
  const have = COACH_DOCUMENTS.filter((d) => !!c[d.key]);
  const missing = COACH_DOCUMENTS.filter((d) => !c[d.key]);
  return { have: have.length, total: COACH_DOCUMENTS.length, missing };
}
