import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const PROTECTED_PREFIXES = [
  "/command-center",
  "/dsp",
  "/registry",
  "/ingestion",
  "/kompetisi",
  "/match-ops",
  "/player-intelligence",
  "/ai-scout",
  "/pengaturan",
  "/tanpa-akses",
];

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (isProtected && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && req.auth) {
    const email = req.auth.user?.email;
    const account = email ? await db.query.users.findFirst({ where: eq(users.email, email), columns: { active: true, role: true } }) : null;
    if (account?.active) return NextResponse.redirect(new URL(account.role === "coach" ? "/dsp" : "/command-center", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|csv|json|webmanifest|txt)$).*)",
  ],
};
