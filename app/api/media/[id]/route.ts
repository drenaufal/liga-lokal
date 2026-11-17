import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getMedia } from "@/lib/media-store";
import { canOpenFinanceProof } from "@/lib/finance/proof";
import { isUuid } from "@/lib/media";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const row = await getMedia(id);
  // A visitor (the open pages show club logos and photos) is served images only; anything else,
  // and anything that does not exist, looks the same to them as a missing login.
  if (!user && row?.kind !== "image") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Identity and licence documents are only visible to people granted "registry:documents";
  // finance receipts are also open to the unit they belong to (lib/finance/proof.ts).
  if (user && row.kind === "document" && !can(user, "registry:documents") && !(await canOpenFinanceProof(user, row))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = new Uint8Array(Buffer.from(row.data, "base64"));
  const name = row.fileName ?? "berkas";
  return new Response(body, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      // Media rows are immutable (a new upload gets a new id), so images cache
      // for good. Identity documents are never kept in the browser cache.
      "Cache-Control":
        row.kind === "document" ? "private, no-store" : "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // An image opened on its own (e.g. an SVG) can never run a script.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
