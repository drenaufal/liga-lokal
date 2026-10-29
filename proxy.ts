import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { OPEN_VIEW_HEADER, isOpenApi, isOpenView, landingFor, safeNextPath } from "@/lib/auth/redirect";
import { buildCsp, generateNonce } from "@/lib/security/csp";

/**
 * FIRST GATE only — it decides "is there a signed-in session?" and nothing else. What a person
 * may do (roles, capabilities, club scoping) is enforced on the server by `requireCapability` /
 * `actionUser` (lib/auth/session.ts) against the live database row, because a proxy can be
 * skipped by a matcher change, and Server Functions are plain POSTs to their page's URL.
 *
 * Deny by default: every page and API route needs a session except the ones listed here.
 *   - public pages: the landing page and the login page
 *   - read-only pages anyone may open: Competition and Player Intelligence (`isOpenView`, lib/auth/redirect.ts)
 *   - /api/auth/*, static assets and /_next/* never reach this file (see `config.matcher`)
 */
const PUBLIC_PAGES = new Set(["/", "/login"]);

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Pages get a per-request nonce CSP; the nonce travels to Next on the request headers.
 * `openView` tells the app layout a visitor without an account may see this page; the header is
 * always dropped from the incoming request first, so a client cannot set it.
 */
function nextWithCsp(req: Request, openView = false) {
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, isDev: IS_DEV });
  const headers = new Headers(req.headers);
  headers.delete(OPEN_VIEW_HEADER);
  if (openView) headers.set(OPEN_VIEW_HEADER, "1");
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const signedIn = !!req.auth;

  if (pathname.startsWith("/api/")) {
    // Route handlers re-check their own capability; this only stops anonymous callers early,
    // with JSON rather than a redirect to an HTML page. Two read-only routes are open (`isOpenApi`).
    return signedIn || isOpenApi(req.method, pathname)
      ? NextResponse.next()
      : NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (!signedIn) {
    if (PUBLIC_PAGES.has(pathname)) return nextWithCsp(req);
    if (isOpenView(req.method, pathname)) return nextWithCsp(req, true);
    // Only a same-origin relative path may ride along as `next`; anything else is dropped.
    const login = new URL("/login", req.nextUrl.origin);
    const next = safeNextPath(pathname + search);
    if (next) login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  if (pathname === "/login") {
    // Keep signed-in people off the login page — but only when the account is still usable.
    // A deleted/deactivated account has a valid cookie yet is sent back to /login by the app
    // layout; redirecting it away from here too would loop forever.
    const email = req.auth?.user?.email;
    const account = email
      ? await db.query.users.findFirst({ where: eq(users.email, email), columns: { active: true, role: true } })
      : null;
    if (account?.active) {
      const target = safeNextPath(req.nextUrl.searchParams.get("next")) ?? landingFor(account.role);
      return NextResponse.redirect(new URL(target, req.nextUrl.origin));
    }
  }

  // Also marked for a signed-in request: if its account turns out to be deleted or deactivated, the
  // layout then shows the visitor view of an open page instead of bouncing to /login.
  return nextWithCsp(req, isOpenView(req.method, pathname));
});

export const config = {
  matcher: [
    /*
     * Everything except: Next.js internals, /api/auth/*, and the static files in /public —
     * the asset folders (Web, landing, login, templates) and root-level icons/manifest.
     * Dotted file names are NOT exempted wholesale, so a dynamic route such as
     * /registry/pemain/[id] can never be reached through a fake "x.png" to dodge the gate.
     */
    "/((?!_next/static|_next/image|api/auth|(?:Web|landing|login|templates)/.+\\.[A-Za-z0-9]+$|[^/]+\\.(?:png|jpe?g|gif|svg|ico|webp|txt|xml|json|webmanifest)$).*)",
  ],
};
