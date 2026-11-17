import { NextResponse } from "next/server";
import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import { getCompetitionScope, getCurrentUser } from "@/lib/auth/session";
import { inCompetitionScope } from "@/lib/competition-scope";
import { can } from "@/lib/auth/rbac";
import { isUuid } from "@/lib/media";
import { getTournamentBase, getTournamentStandings } from "@/lib/queries/competition";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Klasemen of one KU as an Excel file — the same rows and order as the table on the page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user, "competition:view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [tour, rows] = await Promise.all([getTournamentBase(id), getTournamentStandings(id)]);
  if (!tour || !inCompetitionScope(await getCompetitionScope(), tour.competition.id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Group labels only matter when the KU has groups ("-" means a single table).
  const grouped = rows.some((r) => r.group !== "-");
  const head = [...(grouped ? [t("Grup")] : []), t("Peringkat"), t("Klub"), t("Main"), t("Menang::kolom"), t("Seri::kolom"), t("Kalah::kolom"), t("Gol Masuk"), t("Gol Kemasukan"), t("Selisih Gol"), t("Poin::kolom"), t("5 Terakhir")];
  const data: SheetData = [
    head.map((value) => ({ value, fontWeight: "bold" as const, align: "center" as const })),
    ...rows.map((r) => [
      ...(grouped ? [r.group === "-" ? "" : r.group] : []),
      r.rank,
      r.name,
      r.played,
      r.won,
      r.drawn,
      r.lost,
      r.goalsFor,
      r.goalsAgainst,
      r.goalsFor - r.goalsAgainst,
      { value: r.points, fontWeight: "bold" as const },
      r.form.slice(-5).join(" "),
    ]),
  ];
  const widths = [...(grouped ? [8] : []), 11, 34, 8, 9, 8, 8, 11, 15, 12, 8, 14];
  const buffer = await writeXlsxFile(data, {
    sheet: t("Klasemen"),
    columns: widths.map((width) => ({ width })),
    stickyRowsCount: 1,
  }).toBuffer();

  const name = `${t("Klasemen")} ${tour.name}`.replace(/·/g, "-").replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  const ascii = name.replace(/[^\x20-\x7e]/g, "").trim() || t("Klasemen");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="${ascii}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}.xlsx`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
