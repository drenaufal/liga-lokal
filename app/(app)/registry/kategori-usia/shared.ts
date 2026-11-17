import type { AgeCategory } from "@/lib/db/schema";

/* Shared between the category server actions, pages, and client form. */

/** Age categories cover grassroots up to U-20. */
export const MIN_CATEGORY_AGE = 4;
export const MAX_CATEGORY_AGE = 20;

export type CategoryDefaults = {
  code: string;
  label: string;
  maxAge: number;
  halfDuration: number;
  playersOnField: number;
  maxSquad: number;
  ballSize: number;
  substitutions: string;
  fieldType: string;
  notes: string;
};

export function toDefaults(c: AgeCategory): CategoryDefaults {
  return {
    code: c.code,
    label: c.label,
    maxAge: c.maxAge,
    halfDuration: c.rules.halfDuration,
    playersOnField: c.rules.playersOnField,
    maxSquad: c.rules.maxSquad,
    ballSize: c.rules.ballSize,
    substitutions: c.rules.substitutions,
    fieldType: c.rules.fieldType,
    notes: (c.rules.notes ?? []).join("\n"),
  };
}
