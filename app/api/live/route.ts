import { NextResponse } from "next/server";
import { getLiveFeed } from "@/lib/queries/live-feed";

export const dynamic = "force-dynamic";

/**
 * Public, read-only: the matches in play and what the operators just recorded in them. It powers
 * the live slider and notifications on the home page, so it is open to visitors (see `isOpenApi`
 * in lib/auth/redirect.ts). Names are the ones already shown on the open competition pages.
 */
export async function GET() {
  try {
    return NextResponse.json(await getLiveFeed(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[api/live]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
