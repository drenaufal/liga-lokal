/**
 * Papers kept for every coach. Each maps to a URL column on `coaches` that
 * points at a private `document` media row (only people who verify
 * registrations can open it) — the same model as lib/player-documents.ts.
 */

import { msg } from "@/lib/i18n/translate";
export const COACH_DOCUMENTS = [
  {
    key: "licenseDocUrl",
    short: msg("Lisensi"),
    label: msg("Lisensi kepelatihan"),
    hint: msg("Scan / foto sertifikat lisensi — JPG, PNG, atau PDF · maks 5 MB."),
  },
  {
    key: "ktpUrl",
    short: "KTP",
    label: "KTP",
    hint: msg("Scan / foto KTP — JPG, PNG, atau PDF · maks 5 MB."),
  },
] as const;

export type CoachDocumentKey = (typeof COACH_DOCUMENTS)[number]["key"];

export const COACH_DOCUMENT_KEYS = COACH_DOCUMENTS.map((d) => d.key) as CoachDocumentKey[];

type DocFields = Partial<Record<CoachDocumentKey, string | null | undefined>> & { licenseLevel?: string | null };

/** The documents a coach must have: the license scan only when the coach holds a license (it is optional). */
export function requiredCoachDocuments(c: { licenseLevel?: string | null }) {
  return COACH_DOCUMENTS.filter((d) => d.key !== "licenseDocUrl" || !!c.licenseLevel);
}

/** How many of the required documents are on file, and which are missing. */
export function coachDocumentCompleteness(c: DocFields) {
  const required = requiredCoachDocuments(c);
  const have = required.filter((d) => !!c[d.key]);
  const missing = required.filter((d) => !c[d.key]);
  return { have: have.length, total: required.length, missing };
}
