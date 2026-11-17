/**
 * Defence-in-depth CSRF check for state-changing route handlers (POST). Session cookies are
 * SameSite=Lax, which already keeps browsers from attaching them to cross-site POSTs; this
 * additionally rejects a request whose `Origin` names a different site than the one serving it.
 * Requests without an Origin header (curl, server-to-server) are not browser-driven and pass.
 */
export function isSameOrigin(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false; // "null" and other malformed origins
  }

  const allowed = new Set<string>();
  for (const h of [req.headers.get("host"), req.headers.get("x-forwarded-host")]) {
    // x-forwarded-host may be a comma list; the first entry is the one the client used.
    if (h) allowed.add(h.split(",")[0].trim().toLowerCase());
  }
  if (env.AUTH_URL) {
    try {
      allowed.add(new URL(env.AUTH_URL).host.toLowerCase());
    } catch {
      /* ignored: validated at startup */
    }
  }
  return allowed.has(originHost);
}
