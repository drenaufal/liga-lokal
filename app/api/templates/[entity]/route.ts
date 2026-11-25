import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const VALID_ENTITIES = ["players", "clubs", "referees", "venues"] as const;
type ValidEntity = (typeof VALID_ENTITIES)[number];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;
  // Strip optional .csv extension if caller passes players.csv
  const cleanEntity = entity.replace(/\.csv$/i, "") as ValidEntity;

  if (!VALID_ENTITIES.includes(cleanEntity)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", "templates", `${cleanEntity}.csv`);
  try {
    let content = await fs.readFile(filePath, "utf-8");
    // Ensure UTF-8 BOM is present for Excel compatibility
    if (!content.startsWith("\uFEFF")) {
      content = "\uFEFF" + content;
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${cleanEntity}.csv"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }
}
