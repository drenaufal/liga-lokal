import type { TFunction } from "@/lib/i18n/translate";
import type { Formatters } from "@/lib/i18n/format";
import type { PrintKind, PrintRecord } from "@/lib/print/layout";

/** What the template preview shows before a club / KU with people is chosen. */
export function sampleRecord(kind: PrintKind, competition: { name: string; season: string }, t: TFunction, fmt: Formatters): PrintRecord {
  return {
    id: "sample",
    kind: "player",
    label: t("Contoh Pemain"),
    detail: "",
    photoUrl: null,
    values: {
      name: t("Contoh Pemain"),
      dob: fmt.date("2014-03-12", { dateStyle: "long" }),
      age: t("{n} tahun", { n: 12 }),
      club: t("SSB Contoh"),
      nisn: "0012345678",
      role: kind === "name_tag" ? t("Pemain::peran") : "",
      ku: "KU-12",
      number: "10",
      position: "Striker",
      competition: competition.name,
      season: competition.season,
      date: fmt.date(new Date(), { dateStyle: "long" }),
    },
  };
}
