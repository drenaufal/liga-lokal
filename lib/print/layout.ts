import { z } from "zod";
import { msg, type MessageId } from "@/lib/i18n/translate";

/**
 * Print templates (Generate → Name Tag / Sertifikat). A template is an uploaded background image
 * per Turnamen; the layout says where each value goes on it. Every position and size is a
 * fraction of the template (x / w of its width, y / size of its height), so a layout survives a
 * template replaced by a bigger or smaller copy of the same design. Pure: shared by the server
 * actions (validation), the editor and the PDF renderer.
 */

export const PRINT_KINDS = ["name_tag", "certificate"] as const;
export type PrintKind = (typeof PRINT_KINDS)[number];

export const PRINT_KIND_LABEL: Record<PrintKind, MessageId> = {
  name_tag: msg("Name Tag"),
  certificate: msg("Sertifikat"),
};

export const PRINT_FIELD_KEYS = [
  "name",
  "dob",
  "age",
  "club",
  "nisn",
  "role",
  "ku",
  "number",
  "position",
  "competition",
  "season",
  "date",
] as const;
export type PrintFieldKey = (typeof PRINT_FIELD_KEYS)[number];

/** Which values a template of each kind can show, in the order the editor lists them. */
export const KIND_FIELDS: Record<PrintKind, readonly PrintFieldKey[]> = {
  name_tag: ["name", "dob", "age", "club", "nisn", "role", "ku", "number", "position", "competition"],
  certificate: ["name", "club", "ku", "competition", "season", "position", "number", "date"],
};

export const FIELD_LABEL: Record<PrintFieldKey, MessageId> = {
  name: msg("Nama"),
  dob: msg("Tanggal lahir"),
  age: msg("Usia"),
  club: msg("Klub / SSB"),
  nisn: msg("NISN"),
  role: msg("Jabatan"),
  ku: msg("KU"),
  number: msg("No. punggung"),
  position: msg("Posisi"),
  competition: msg("Turnamen"),
  season: msg("Musim"),
  date: msg("Tanggal terbit"),
};

/** The app's own typefaces: display = Anton, sans = Poppins, headline = Bebas Neue. */
export const PRINT_FONTS = ["display", "sans", "headline"] as const;
export type PrintFont = (typeof PRINT_FONTS)[number];
export const FONT_LABEL: Record<PrintFont, string> = { display: "Anton", sans: "Poppins", headline: "Bebas Neue" };

export type PrintTextField = {
  key: PrintFieldKey;
  visible: boolean;
  /** Anchor: the left edge, the centre or the right edge of the text, depending on `align`. */
  x: number;
  /** Vertical centre of the line. */
  y: number;
  /** Longest the text may be; a longer value is shrunk to fit. */
  w: number;
  /** Font size as a share of the template height. */
  size: number;
  align: "left" | "center" | "right";
  color: string;
  font: PrintFont;
  /** Poppins only: bold instead of regular. */
  bold: boolean;
  upper: boolean;
};

export type PrintPhotoBox = { visible: boolean; x: number; y: number; w: number; h: number; radius: number };

export type PrintLayout = {
  version: 1;
  /** Printed width of one page in millimetres; the height follows the template's proportions. */
  widthMm: number;
  fields: PrintTextField[];
  /** Name tags only. */
  photo: PrintPhotoBox | null;
};

const NAVY = "#0b1d51";

const field = (key: PrintFieldKey, rest: Partial<PrintTextField>): PrintTextField => ({
  key,
  visible: true,
  x: 0.5,
  y: 0.5,
  w: 0.6,
  size: 0.03,
  align: "left",
  color: NAVY,
  font: "display",
  bold: true,
  upper: true,
  ...rest,
});

/**
 * Name tag: measured on the LigaLokal / JIS template (1500 × 2000, portrait). The six value
 * boxes (NAMA, TGL LAHIR, USIA, CLUB, NISN, JABATAN) start right after their colon at 66 % of the
 * width; the photo fills the white frame on the left.
 */
const NAME_TAG_ROWS: [PrintFieldKey, number][] = [
  ["name", 0.494],
  ["dob", 0.5577],
  ["age", 0.6195],
  ["club", 0.6803],
  ["nisn", 0.7398],
  ["role", 0.7985],
];

export function defaultLayout(kind: PrintKind): PrintLayout {
  if (kind === "name_tag") {
    return {
      version: 1,
      widthMm: 100,
      fields: [
        ...NAME_TAG_ROWS.map(([key, y]) => field(key, { x: 0.66, y, w: 0.29, size: 0.026 })),
        // extra values, off until someone places them on their own design
        field("ku", { visible: false, x: 0.66, y: 0.86, w: 0.29, size: 0.022 }),
        field("number", { visible: false, x: 0.2, y: 0.84, w: 0.2, size: 0.04, align: "center" }),
        field("position", { visible: false, x: 0.66, y: 0.9, w: 0.29, size: 0.02 }),
        field("competition", { visible: false, x: 0.5, y: 0.94, w: 0.8, size: 0.02, align: "center" }),
      ],
      photo: { visible: true, x: 0.0427, y: 0.454, w: 0.324, h: 0.343, radius: 0.02 },
    };
  }
  // Certificate: A4 landscape, the usual centred block under the title of the design.
  return {
    version: 1,
    widthMm: 297,
    fields: [
      field("name", { x: 0.5, y: 0.47, w: 0.72, size: 0.075, align: "center", font: "headline", color: "#141414" }),
      field("club", { x: 0.5, y: 0.565, w: 0.6, size: 0.032, align: "center", font: "sans", color: "#141414", upper: false }),
      field("ku", { x: 0.5, y: 0.62, w: 0.6, size: 0.028, align: "center", font: "sans", color: "#141414", upper: false }),
      field("competition", { visible: false, x: 0.5, y: 0.67, w: 0.7, size: 0.028, align: "center", font: "sans", color: "#141414", upper: false }),
      field("season", { visible: false, x: 0.5, y: 0.72, w: 0.3, size: 0.024, align: "center", font: "sans", color: "#141414", upper: false }),
      field("position", { visible: false, x: 0.5, y: 0.76, w: 0.4, size: 0.024, align: "center", font: "sans", color: "#141414", upper: false }),
      field("number", { visible: false, x: 0.5, y: 0.8, w: 0.2, size: 0.03, align: "center", color: "#141414" }),
      field("date", { visible: false, x: 0.75, y: 0.86, w: 0.3, size: 0.022, align: "center", font: "sans", color: "#141414", upper: false, bold: false }),
    ],
    photo: null,
  };
}

const unit = z.number().finite().min(0).max(1);
const fieldSchema = z.object({
  key: z.enum(PRINT_FIELD_KEYS),
  visible: z.boolean(),
  x: unit,
  y: unit,
  w: z.number().finite().min(0.02).max(1),
  size: z.number().finite().min(0.005).max(0.25),
  align: z.enum(["left", "center", "right"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  font: z.enum(PRINT_FONTS),
  bold: z.boolean(),
  upper: z.boolean(),
});
const photoSchema = z.object({
  visible: z.boolean(),
  x: unit,
  y: unit,
  w: z.number().finite().min(0.02).max(1),
  h: z.number().finite().min(0.02).max(1),
  radius: z.number().finite().min(0).max(0.2),
});
export const printLayoutSchema = z.object({
  version: z.literal(1),
  widthMm: z.number().finite().min(30).max(1000),
  fields: z.array(fieldSchema).max(PRINT_FIELD_KEYS.length),
  photo: photoSchema.nullable(),
});

/**
 * A stored layout completed with today's defaults: a field the kind gained later appears in its
 * default place, a field the kind no longer offers is dropped, anything malformed falls back.
 */
export function normalizeLayout(kind: PrintKind, raw: unknown): PrintLayout {
  const base = defaultLayout(kind);
  const parsed = printLayoutSchema.safeParse(raw);
  if (!parsed.success) return base;
  const stored = new Map(parsed.data.fields.map((f) => [f.key, f]));
  return {
    version: 1,
    widthMm: parsed.data.widthMm,
    fields: KIND_FIELDS[kind].map((key) => stored.get(key) ?? base.fields.find((f) => f.key === key)!),
    photo: kind === "name_tag" ? (parsed.data.photo ?? base.photo) : null,
  };
}

/** Page size in PDF points (1/72 inch) for a template of `width` × `height` pixels. */
export function pageSizePt(layout: PrintLayout, width: number, height: number) {
  const w = (layout.widthMm / 25.4) * 72;
  return { width: w, height: w * (height / width) };
}

/** One person on a sheet: the ready-to-print text of every value, and a photo for name tags. */
export type PrintRecord = {
  id: string;
  kind: "player" | "coach";
  label: string;
  /** Shown in the list under the name (KU, position or coaching role). */
  detail: string;
  photoUrl: string | null;
  values: Partial<Record<PrintFieldKey, string>>;
};

/** The text a field prints for a record ("-" when the value is unknown). */
export function fieldText(f: PrintTextField, record: Pick<PrintRecord, "values">) {
  const v = record.values[f.key]?.trim() || "-";
  return f.upper ? v.toLocaleUpperCase("id-ID") : v;
}

/** Age in whole years on `on` (WIB calendar dates, so no time-zone drift). */
export function ageOn(dob: string | Date, on: Date) {
  const day = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(d));
  const [by, bm, bd] = day(dob).split("-").map(Number);
  const [ty, tm, td] = day(on).split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** A file name without characters that trouble browsers or file systems. */
export function printFileName(...parts: (string | null | undefined)[]) {
  return (
    parts
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "cetak"
  ) + ".pdf";
}
